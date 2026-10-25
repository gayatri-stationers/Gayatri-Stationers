import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Sparkles,
  Send,
  X,
  ShoppingBag,
  Mic,
  MicOff,
  Square,
  Bot,
  HelpCircle,
  Globe,
  ExternalLink,
  Search,
  TrendingUp,
  Scale,
} from 'lucide-react';
import { formatPaiseToINR } from '../lib/domain-logic.ts';
import { ProductIllustration } from './ProductIllustration.tsx';

export interface RufusChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  recommendedProductIds?: number[];
  followUpQuestions?: string[];
  searchGrounded?: boolean;
  groundingSources?: Array<{ uri: string; title: string }>;
  searchQueries?: string[];
}

interface RufusAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  products: any[];
  activeProduct?: any | null;
  onAddToCart: (product: any) => void;
  onOpenProduct: (product: any) => void;
  onFilterCategory?: (categorySlug: string) => void;
  onToggleCompare?: (productId: number) => void;
  compareProductIds?: number[];
  onOpenComparison?: () => void;
  initialQuestion?: string | null;
  onClearInitialQuestion?: () => void;
}

const DEFAULT_STARTER_QUESTIONS = [
  '2026 stationery market trends & top exam pens in India?',
  'Compare Classmate vs Navneet notebook prices & reviews',
  'Customer reviews & ratings for DOMS art & geometry kits',
  'Best pens for fast board exam writing under ₹150?',
];

export function RufusAssistant({
  isOpen,
  onClose,
  products,
  activeProduct,
  onAddToCart,
  onOpenProduct,
  onFilterCategory,
  onToggleCompare,
  compareProductIds = [],
  onOpenComparison,
  initialQuestion,
  onClearInitialQuestion,
}: RufusAssistantProps) {
  const [messages, setMessages] = useState<RufusChatMessage[]>([
    {
      id: 'welcome-vidya',
      role: 'assistant',
      text: 'Namaste! I’m **Vidya AI**, your Gayatri Stationers Shopping & Study Guide — now powered by **Google Search Grounding** for real-time Indian stationery market trends, live price comparisons across brands, and verified product reviews. Ask me anything by typing or tapping the **Microphone** below!',
      recommendedProductIds: products
        .filter((p) => p && p.isActive !== false && p.isBestseller)
        .slice(0, 2)
        .map((p) => Number(p.id)),
      followUpQuestions: DEFAULT_STARTER_QUESTIONS,
      searchGrounded: true,
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<string | null>(null);
  const [enableSearchGrounding, setEnableSearchGrounding] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Refs for hybrid SpeechRecognition + MediaRecorder voice capture
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const speechTranscriptRef = useRef<string>('');
  const silenceTimerRef = useRef<any>(null);
  const maxRecordTimerRef = useRef<any>(null);
  const hasSubmittedVoiceRef = useRef<boolean>(false);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [messages, loading, isOpen, voiceStatus]);

  const cleanupVoiceResources = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (maxRecordTimerRef.current) {
      clearTimeout(maxRecordTimerRef.current);
      maxRecordTimerRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // ignore
      }
    }
    mediaRecorderRef.current = null;
    if (mediaStreamRef.current) {
      try {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      } catch {
        // ignore
      }
      mediaStreamRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      cleanupVoiceResources();
      setListening(false);
      setTranscribing(false);
      setVoiceStatus(null);
    }
    return () => {
      cleanupVoiceResources();
    };
  }, [isOpen, cleanupVoiceResources]);

  const sendQuestion = async (questionText: string) => {
    const cleanQ = questionText.trim();
    if (!cleanQ || loading) return;

    const userMsg: RufusChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: cleanQ,
    };

    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInput('');
    setVoiceStatus(null);
    setLoading(true);

    try {
      const contextualQuestion = activeProduct
        ? `[Customer is currently viewing product: "${activeProduct.name}" (${activeProduct.brandName}, ₹${Math.round(
            Number(activeProduct.sellingPricePaise || 0) / 100
          )}, SKU: ${activeProduct.sku})] ${cleanQ}`
        : cleanQ;

      const res = await fetch('/api/ai/rufus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: contextualQuestion,
          enableSearchGrounding,
          currentProduct: activeProduct
            ? {
                id: activeProduct.id,
                sku: activeProduct.sku,
                name: activeProduct.name,
                brandName: activeProduct.brandName,
                categoryName: activeProduct.categoryName,
                sellingPricePaise: activeProduct.sellingPricePaise,
                mrpPaise: activeProduct.mrpPaise,
                shortDescription: activeProduct.shortDescription,
              }
            : null,
          history: nextHistory.slice(-6).map((m) => ({
            role: m.role,
            text: m.text,
          })),
          catalogue: products.slice(0, 40).map((p) => ({
            id: p.id,
            sku: p.sku,
            name: p.name,
            brandName: p.brandName,
            categoryName: p.categoryName,
            categorySlug: p.categorySlug,
            sellingPricePaise: p.sellingPricePaise,
            mrpPaise: p.mrpPaise,
            shortDescription: p.shortDescription,
            isActive: p.isActive,
          })),
        }),
      });

      const data = await res.json();
      const assistantMsg: RufusChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        text:
          data?.answer ||
          'Here are our top stationery recommendations available for ₹0 Store Pickup and Pan-India Shiprocket Home Delivery.',
        recommendedProductIds: Array.isArray(data?.recommendedProductIds)
          ? data.recommendedProductIds.map((id: any) => Number(id))
          : [],
        followUpQuestions:
          Array.isArray(data?.followUpQuestions) && data.followUpQuestions.length > 0
            ? data.followUpQuestions
            : DEFAULT_STARTER_QUESTIONS.slice(0, 3),
        searchGrounded: Boolean(data?.searchGrounded),
        groundingSources: Array.isArray(data?.groundingSources) ? data.groundingSources : [],
        searchQueries: Array.isArray(data?.searchQueries) ? data.searchQueries : [],
      };

      setMessages((prev) => [...prev, assistantMsg]);

      // Execute optional client action if customer asked Vidya AI to add to cart or filter
      if (data?.clientAction?.type === 'ADD_TO_CART' && data.clientAction.productId) {
        const targetProd = products.find(
          (p) => Number(p.id) === Number(data.clientAction.productId)
        );
        if (targetProd) {
          onAddToCart(targetProd);
        }
      } else if (data?.clientAction?.type === 'OPEN_PRODUCT' && data.clientAction.productId) {
        const targetProd = products.find(
          (p) => Number(p.id) === Number(data.clientAction.productId)
        );
        if (targetProd) {
          onOpenProduct(targetProd);
        }
      } else if (
        data?.clientAction?.type === 'FILTER_CATEGORY' &&
        data.clientAction.categorySlug &&
        onFilterCategory
      ) {
        onFilterCategory(data.clientAction.categorySlug);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-err-${Date.now()}`,
          role: 'assistant',
          text: 'I found our bestselling stationery items for you below. Tap any product card to view details or add to your bag!',
          recommendedProductIds: products.slice(0, 2).map((p) => Number(p.id)),
          followUpQuestions: DEFAULT_STARTER_QUESTIONS.slice(0, 3),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && initialQuestion && initialQuestion.trim()) {
      const q = initialQuestion;
      if (onClearInitialQuestion) onClearInitialQuestion();
      sendQuestion(q);
    }
  }, [isOpen, initialQuestion]);

  const blobToBase64 = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = String(reader.result || '');
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

  const finalizeAndSubmitVoice = async (recordedBlob?: Blob | null) => {
    if (hasSubmittedVoiceRef.current) return;
    hasSubmittedVoiceRef.current = true;
    setListening(false);

    const directSpeech = speechTranscriptRef.current.trim();
    if (directSpeech) {
      setInput(directSpeech);
      setVoiceStatus(null);
      await sendQuestion(directSpeech);
      return;
    }

    if (recordedBlob && recordedBlob.size > 400) {
      setTranscribing(true);
      setVoiceStatus('Transcribing your voice query with Vidya AI...');
      try {
        const audioBase64 = await blobToBase64(recordedBlob);
        const res = await fetch('/api/ai/transcribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audioBase64,
            mimeType: recordedBlob.type || 'audio/webm',
          }),
        });
        const data = await res.json();
        const text = String(data?.transcript || '').trim();
        if (text) {
          setInput(text);
          setTranscribing(false);
          setVoiceStatus(null);
          await sendQuestion(text);
          return;
        }
      } catch {
        // Fallback below
      } finally {
        setTranscribing(false);
      }
    }

    setVoiceStatus('No clear speech heard. Please speak closer to the mic or tap a prompt above.');
  };

  const stopVoiceRecording = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (maxRecordTimerRef.current) {
      clearTimeout(maxRecordTimerRef.current);
      maxRecordTimerRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
        return; // mediaRecorder.onstop will call finalizeAndSubmitVoice
      } catch {
        // ignore
      }
    }
    if (mediaStreamRef.current) {
      try {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      } catch {
        // ignore
      }
      mediaStreamRef.current = null;
    }
    finalizeAndSubmitVoice(null);
  };

  const handleVoiceAsk = async () => {
    if (listening) {
      stopVoiceRecording();
      return;
    }
    if (loading || transcribing) return;

    cleanupVoiceResources();
    speechTranscriptRef.current = '';
    audioChunksRef.current = [];
    hasSubmittedVoiceRef.current = false;
    setVoiceStatus('Listening... Speak your stationery question (tap mic again to send)');
    setListening(true);

    let mediaRecorderStarted = false;

    // 1. Start MediaRecorder via getUserMedia for reliable cross-browser & iframe capture
    if (
      typeof navigator !== 'undefined' &&
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === 'function'
    ) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;

        if (typeof MediaRecorder !== 'undefined') {
          const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
            ? 'audio/webm;codecs=opus'
            : MediaRecorder.isTypeSupported('audio/webm')
            ? 'audio/webm'
            : MediaRecorder.isTypeSupported('audio/mp4')
            ? 'audio/mp4'
            : '';
          const recorder = mimeType
            ? new MediaRecorder(stream, { mimeType })
            : new MediaRecorder(stream);
          mediaRecorderRef.current = recorder;
          audioChunksRef.current = [];

          recorder.ondataavailable = (ev) => {
            if (ev.data && ev.data.size > 0) {
              audioChunksRef.current.push(ev.data);
            }
          };

          recorder.onstop = () => {
            const blob =
              audioChunksRef.current.length > 0
                ? new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' })
                : null;
            if (mediaStreamRef.current) {
              try {
                mediaStreamRef.current.getTracks().forEach((t) => t.stop());
              } catch {
                // ignore
              }
              mediaStreamRef.current = null;
            }
            finalizeAndSubmitVoice(blob);
          };

          recorder.start(250);
          mediaRecorderStarted = true;
        }
      } catch (err: any) {
        const errName = String(err?.name || '');
        if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
          setListening(false);
          setVoiceStatus(
            'Microphone access was blocked by the browser. Please allow microphone permission in your browser address bar, then tap the mic again.'
          );
          return;
        }
      }
    }

    // 2. Also run Web Speech API (SpeechRecognition) for instant live transcript in input
    const SpeechRecognition =
      typeof window !== 'undefined'
        ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        : null;

    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;
        recognition.lang = 'en-IN';
        recognition.interimResults = true;
        recognition.continuous = true;
        recognition.maxAlternatives = 1;

        recognition.onresult = (event: any) => {
          let combined = '';
          for (let i = 0; i < (event?.results?.length || 0); i++) {
            combined += event.results[i][0]?.transcript || '';
          }
          const clean = combined.trim();
          if (clean) {
            speechTranscriptRef.current = clean;
            setInput(clean);
            setVoiceStatus(`Heard: "${clean}" — tap Stop/Send or pause to submit`);

            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = setTimeout(() => {
              stopVoiceRecording();
            }, 1800);
          }
        };

        recognition.onerror = (event: any) => {
          const errorCode = String(event?.error || '');
          if (errorCode === 'not-allowed' || errorCode === 'service-not-allowed') {
            if (!mediaRecorderStarted) {
              setListening(false);
              setVoiceStatus(
                'Microphone permission is required for voice search. Please allow microphone access in your browser.'
              );
            }
          } else if (!mediaRecorderStarted && !speechTranscriptRef.current) {
            setListening(false);
            setVoiceStatus('Could not capture voice. Please try speaking again or type below.');
          }
        };

        recognition.onend = () => {
          if (!mediaRecorderStarted) {
            if (speechTranscriptRef.current.trim()) {
              finalizeAndSubmitVoice(null);
            } else {
              setListening(false);
            }
          }
        };

        recognition.start();
      } catch {
        if (!mediaRecorderStarted) {
          setListening(false);
          setVoiceStatus('Voice recognition could not start in this browser.');
          return;
        }
      }
    } else if (!mediaRecorderStarted) {
      setListening(false);
      setVoiceStatus('Microphone is not supported in this browser environment.');
      return;
    }

    // Auto-stop after 7 seconds so recording never hangs indefinitely
    maxRecordTimerRef.current = setTimeout(() => {
      stopVoiceRecording();
    }, 7000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-end sm:p-4 bg-slate-950/40 backdrop-blur-xs">
      <div className="w-full sm:max-w-md h-[88vh] sm:h-[700px] bg-white border border-slate-200 rounded-t-[28px] sm:rounded-[28px] shadow-2xl flex flex-col overflow-hidden">
        {/* Header — Vidya AI Brand Bar */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-slate-900 via-slate-900 to-[#B42318] text-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-full bg-white/15 border border-white/25 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-amber-300" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-serif-display text-base font-bold tracking-tight truncate">
                  Ask Vidya AI
                </h2>
                <span className="px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider bg-amber-400/20 text-amber-200 border border-amber-300/30 rounded-full font-bold">
                  Search Grounded
                </span>
              </div>
              <p className="text-[11px] text-slate-300 truncate">
                Real-time market trends, price comparisons & reviews
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Vidya AI Assistant"
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Google Search Grounding Bar + Market Trend Quick Prompts */}
        <div className="px-4 py-2 bg-slate-900/95 text-white border-b border-slate-800 flex flex-col gap-1.5 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-200">
              <Globe className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="font-medium">Google Search Grounding</span>
              <span className="text-[10px] text-slate-400 hidden sm:inline">
                (Trends · Pricing · Reviews)
              </span>
            </div>
            <button
              type="button"
              onClick={() => setEnableSearchGrounding((prev) => !prev)}
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider font-bold border transition-colors cursor-pointer ${
                enableSearchGrounding
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              {enableSearchGrounding ? 'LIVE WEB: ON' : 'LIVE WEB: OFF'}
            </button>
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            <button
              type="button"
              disabled={loading}
              onClick={() =>
                sendQuestion(
                  'What are the latest 2026 stationery market trends in India for school & competitive exam students?'
                )
              }
              className="px-2.5 py-1 bg-white/10 hover:bg-white/15 border border-white/15 rounded-full text-[10px] text-amber-200 whitespace-nowrap inline-flex items-center gap-1 cursor-pointer shrink-0"
            >
              <TrendingUp className="w-3 h-3" />
              <span>Market Trends</span>
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() =>
                sendQuestion(
                  activeProduct
                    ? `Compare the price of ${activeProduct.name} (${formatPaiseToINR(
                        activeProduct.sellingPricePaise
                      )}) with market prices across India and similar competing brands.`
                    : 'Compare prices of Classmate, Navneet, and DOMS stationery items in the Indian market vs Gayatri Stationers store prices.'
                )
              }
              className="px-2.5 py-1 bg-white/10 hover:bg-white/15 border border-white/15 rounded-full text-[10px] text-emerald-200 whitespace-nowrap inline-flex items-center gap-1 cursor-pointer shrink-0"
            >
              <Search className="w-3 h-3" />
              <span>Price Comparison</span>
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() =>
                sendQuestion(
                  activeProduct
                    ? `What do real customer reviews say about ${activeProduct.name} (${activeProduct.brandName}) for daily student and office use?`
                    : 'What are the highest-rated ball & roller pens and geometry boxes in India according to student reviews?'
                )
              }
              className="px-2.5 py-1 bg-white/10 hover:bg-white/15 border border-white/15 rounded-full text-[10px] text-sky-200 whitespace-nowrap inline-flex items-center gap-1 cursor-pointer shrink-0"
            >
              <Sparkles className="w-3 h-3" />
              <span>Product Reviews</span>
            </button>
          </div>
        </div>

        {/* Context Banner if viewing a specific product */}
        {activeProduct && (
          <div className="px-4 py-2 bg-amber-50 border-b border-amber-200/80 flex items-center justify-between gap-2 text-[11px] text-amber-950 shrink-0">
            <span className="truncate">
              Viewing: <strong>{activeProduct.name}</strong> (
              {formatPaiseToINR(activeProduct.sellingPricePaise)})
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() =>
                  sendQuestion(
                    `Compare ${activeProduct.name} price (${formatPaiseToINR(
                      activeProduct.sellingPricePaise
                    )}) and reviews with competing brands in India.`
                  )
                }
                className="px-2.5 py-0.5 bg-amber-900 text-white rounded-full text-[10px] font-semibold shrink-0 cursor-pointer"
              >
                Compare & Reviews
              </button>
            </div>
          </div>
        )}

        {/* Messages Stream */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#FAFAFA]"
        >
          {messages.map((msg) => {
            const recProducts = (msg.recommendedProductIds || [])
              .map((id) => products.find((p) => Number(p.id) === Number(id)))
              .filter(Boolean);

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${
                  msg.role === 'user' ? 'items-end' : 'items-start'
                } space-y-2`}
              >
                <div
                  className={`max-w-[90%] px-4 py-3 rounded-[22px] text-xs leading-relaxed whitespace-pre-line shadow-2xs ${
                    msg.role === 'user'
                      ? 'bg-slate-900 text-white rounded-br-xs'
                      : 'bg-white border border-slate-200/90 text-slate-800 rounded-bl-xs'
                  }`}
                >
                  {msg.role === 'assistant' && (
                    <div className="flex items-center justify-between gap-2 text-[10px] font-mono uppercase tracking-wider text-[#B42318] font-bold mb-1">
                      <span className="inline-flex items-center gap-1.5">
                        <Bot className="w-3.5 h-3.5" />
                        <span>Vidya AI · Gayatri Stationers</span>
                      </span>
                      {msg.searchGrounded && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[9px]">
                          <Globe className="w-2.5 h-2.5" />
                          <span>Google Search</span>
                        </span>
                      )}
                    </div>
                  )}
                  <div>
                    {msg.text.split('**').map((part, i) =>
                      i % 2 === 1 ? (
                        <strong key={i} className="font-bold">
                          {part}
                        </strong>
                      ) : (
                        <span key={i}>{part}</span>
                      )
                    )}
                  </div>

                  {/* Google Search Grounding Sources / Citations */}
                  {msg.role === 'assistant' &&
                    Array.isArray(msg.groundingSources) &&
                    msg.groundingSources.length > 0 && (
                      <div className="mt-3 pt-2.5 border-t border-slate-100">
                        <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-semibold mb-1.5 flex items-center gap-1">
                          <Globe className="w-3 h-3 text-emerald-600" />
                          <span>Verified Google Search Sources ({msg.groundingSources.length})</span>
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {msg.groundingSources.map((src, sIdx) => (
                            <a
                              key={`${msg.id}-src-${sIdx}`}
                              href={src.uri}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-50 hover:bg-slate-100 border border-slate-200 text-[10px] text-slate-700 hover:text-[#B42318] font-medium transition-colors max-w-full"
                            >
                              <span className="truncate max-w-[190px]">{src.title}</span>
                              <ExternalLink className="w-2.5 h-2.5 shrink-0 opacity-70" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* Search Queries Used */}
                  {msg.role === 'assistant' &&
                    Array.isArray(msg.searchQueries) &&
                    msg.searchQueries.length > 0 && (
                      <div className="mt-2 flex flex-wrap items-center gap-1">
                        <span className="text-[9px] font-mono uppercase text-slate-400">
                          Searched:
                        </span>
                        {msg.searchQueries.slice(0, 3).map((q, qIdx) => (
                          <span
                            key={`${msg.id}-sq-${qIdx}`}
                            className="text-[9px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded"
                          >
                            &ldquo;{q}&rdquo;
                          </span>
                        ))}
                      </div>
                    )}
                </div>

                {/* Recommended Product Cards inside Vidya AI Chat */}
                {recProducts.length > 0 && (
                  <div className="w-full space-y-2 pl-1">
                    {recProducts.map((prod: any) => {
                      const variant = prod.variants?.[0];
                      const price = variant?.sellingPricePaise ?? prod.sellingPricePaise ?? 0;
                      const mrp = variant?.mrpPaise ?? prod.mrpPaise ?? price;
                      return (
                        <div
                          key={`vidya-rec-${msg.id}-${prod.id}`}
                          className="p-3 bg-white border border-slate-200/90 rounded-[20px] shadow-2xs flex items-center justify-between gap-3"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              onOpenProduct(prod);
                              onClose();
                            }}
                            className="flex items-center gap-2.5 text-left min-w-0 flex-1 cursor-pointer group"
                          >
                            <div className="w-12 h-12 rounded-xl border border-slate-200 bg-slate-50 overflow-hidden shrink-0">
                              <ProductIllustration
                                type={prod.illustrationType}
                                imageUrl={prod.imageUrl}
                                alt={prod.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-900 group-hover:text-[#B42318] truncate">
                                {prod.name}
                              </p>
                              <p className="text-[10px] text-slate-500 truncate">
                                {prod.brandName} · {prod.categoryName}
                              </p>
                              <div className="flex items-center gap-1.5 font-mono-tabular mt-0.5">
                                <span className="text-xs font-bold text-slate-900">
                                  {formatPaiseToINR(price)}
                                </span>
                                {mrp > price && (
                                  <span className="text-[10px] text-slate-400 line-through">
                                    {formatPaiseToINR(mrp)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </button>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {onToggleCompare && (
                              <button
                                type="button"
                                onClick={() => onToggleCompare(Number(prod.id))}
                                title="Add to Side-by-Side Comparison"
                                className={`px-2.5 py-2 text-[10px] font-semibold rounded-full border cursor-pointer flex items-center gap-1 transition-colors ${
                                  compareProductIds.includes(Number(prod.id))
                                    ? 'bg-slate-900 text-white border-slate-900'
                                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                                }`}
                              >
                                <Scale className="w-3 h-3" />
                                <span>
                                  {compareProductIds.includes(Number(prod.id))
                                    ? 'Comparing'
                                    : 'Compare'}
                                </span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => onAddToCart(prod)}
                              className="px-3.5 py-2 bg-[#B42318] hover:bg-[#991B1B] text-white text-[11px] font-semibold rounded-full shrink-0 cursor-pointer flex items-center gap-1 shadow-2xs"
                            >
                              <ShoppingBag className="w-3 h-3" />
                              <span>+ Add</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {compareProductIds.length >= 2 && onOpenComparison && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenComparison();
                        }}
                        className="w-full py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-semibold rounded-full flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                      >
                        <Scale className="w-3.5 h-3.5 text-amber-300" />
                        <span>
                          Open Side-by-Side Comparison Table ({compareProductIds.length}/3 Selected) →
                        </span>
                      </button>
                    )}
                  </div>
                )}

                {/* Follow-Up Question Chips */}
                {msg.role === 'assistant' &&
                  Array.isArray(msg.followUpQuestions) &&
                  msg.followUpQuestions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {msg.followUpQuestions.map((fq, idx) => (
                        <button
                          key={`${msg.id}-fq-${idx}`}
                          type="button"
                          onClick={() => sendQuestion(fq)}
                          disabled={loading}
                          className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200/90 rounded-full text-[11px] text-slate-700 font-medium inline-flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                        >
                          <HelpCircle className="w-3 h-3 text-[#B42318] shrink-0" />
                          <span className="truncate max-w-[230px]">{fq}</span>
                        </button>
                      ))}
                    </div>
                  )}
              </div>
            );
          })}

          {loading && (
            <div className="flex items-center gap-2 px-4 py-3 bg-white border border-slate-200 rounded-[20px] w-fit text-xs text-slate-600 shadow-2xs">
              <Sparkles className="w-3.5 h-3.5 text-[#B42318] animate-spin" />
              <span>
                {enableSearchGrounding
                  ? 'Vidya AI is searching Google & checking Gayatri Stationers catalogue...'
                  : 'Vidya AI is checking Gayatri Stationers catalogue...'}
              </span>
            </div>
          )}
        </div>

        {/* Live Microphone / Voice Status Banner */}
        {(listening || transcribing || voiceStatus) && (
          <div
            className={`px-4 py-2 border-t text-[11px] flex items-center justify-between gap-2 shrink-0 ${
              listening
                ? 'bg-red-50 border-red-200 text-red-900'
                : transcribing
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-slate-100 border-slate-200 text-slate-700'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              {listening ? (
                <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping shrink-0" />
              ) : transcribing ? (
                <Sparkles className="w-3.5 h-3.5 text-amber-600 animate-spin shrink-0" />
              ) : (
                <Mic className="w-3.5 h-3.5 text-slate-600 shrink-0" />
              )}
              <span className="truncate font-medium">
                {voiceStatus ||
                  (listening
                    ? 'Listening... Speak your stationery query now'
                    : 'Transcribing voice with Vidya AI...')}
              </span>
            </div>
            {listening ? (
              <button
                type="button"
                onClick={stopVoiceRecording}
                className="px-2.5 py-0.5 bg-red-600 hover:bg-red-700 text-white rounded-full text-[10px] font-bold shrink-0 cursor-pointer"
              >
                Stop &amp; Send
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setVoiceStatus(null)}
                className="text-[10px] underline shrink-0 cursor-pointer"
              >
                Dismiss
              </button>
            )}
          </div>
        )}

        {/* Input Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (listening) {
              stopVoiceRecording();
              return;
            }
            sendQuestion(input);
          }}
          className="p-3 bg-white border-t border-slate-200 flex items-center gap-2 shrink-0"
        >
          <button
            type="button"
            onClick={handleVoiceAsk}
            disabled={loading || transcribing}
            aria-label={listening ? 'Stop voice recording and send' : 'Speak to Vidya AI'}
            title={listening ? 'Tap to stop recording & send' : 'Speak to Vidya AI (Voice Input)'}
            className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 cursor-pointer transition-all ${
              listening
                ? 'bg-red-600 text-white ring-4 ring-red-200 animate-pulse'
                : transcribing
                ? 'bg-amber-100 text-amber-800'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            {listening ? (
              <Square className="w-3.5 h-3.5 fill-current" />
            ) : (
              <Mic className="w-4 h-4" />
            )}
          </button>

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              listening
                ? 'Listening... speak now or tap red stop button'
                : "Tap mic to speak or ask trends, prices, reviews..."
            }
            className="flex-1 px-4 py-2 text-xs bg-slate-100 focus:bg-white border border-slate-200 focus:border-slate-900 rounded-full focus:outline-none text-slate-900"
          />

          <button
            type="submit"
            disabled={(!input.trim() && !listening) || loading || transcribing}
            className="w-9 h-9 rounded-full bg-[#B42318] hover:bg-[#991B1B] disabled:opacity-40 text-white flex items-center justify-center shrink-0 cursor-pointer transition-colors shadow-2xs"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
}

