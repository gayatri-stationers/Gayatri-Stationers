import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Sparkles,
  Send,
  X,
  ShoppingBag,
  Mic,
  Square,
  Bot,
  HelpCircle,
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
  'Best pens for fast board exam writing under ₹150?',
  'What promo coupons can I apply right now?',
  'Recommend art supplies & sketchbooks for students',
  'How does ₹0 Store Pickup work in Kanpur?',
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
      text: 'Namaste! I’m **Vidya AI**, your Gayatri Stationers guide. Ask me for notebook & pen recommendations, active coupon discounts, school combo ideas, or compare products instantly.',
      recommendedProductIds: products
        .filter((p) => p && p.isActive !== false && p.isBestseller)
        .slice(0, 2)
        .map((p) => Number(p.id)),
      followUpQuestions: DEFAULT_STARTER_QUESTIONS,
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [messages, loading, isOpen, voiceStatus]);

  const stopVoice = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    setListening(false);
  }, []);

  useEffect(() => {
    if (!isOpen) stopVoice();
    return () => stopVoice();
  }, [isOpen, stopVoice]);

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
        ? `[Viewing: "${activeProduct.name}" (${activeProduct.brandName}, ₹${Math.round(
            Number(activeProduct.sellingPricePaise || 0) / 100
          )})] ${cleanQ}`
        : cleanQ;

      const res = await fetch('/api/ai/rufus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: contextualQuestion,
          currentProduct: activeProduct
            ? {
                id: activeProduct.id,
                sku: activeProduct.sku,
                name: activeProduct.name,
                brandName: activeProduct.brandName,
                categoryName: activeProduct.categoryName,
                sellingPricePaise: activeProduct.sellingPricePaise,
              }
            : null,
          history: nextHistory.slice(-6).map((m) => ({ role: m.role, text: m.text })),
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
          'Here are top stationery picks from Gayatri Stationers with ₹0 Store Pickup and Home Delivery.',
        recommendedProductIds: Array.isArray(data?.recommendedProductIds)
          ? data.recommendedProductIds.map((id: any) => Number(id))
          : [],
        followUpQuestions:
          Array.isArray(data?.followUpQuestions) && data.followUpQuestions.length > 0
            ? data.followUpQuestions
            : DEFAULT_STARTER_QUESTIONS.slice(0, 3),
      };

      setMessages((prev) => [...prev, assistantMsg]);

      if (data?.clientAction?.type === 'ADD_TO_CART' && data.clientAction.productId) {
        const target = products.find((p) => Number(p.id) === Number(data.clientAction.productId));
        if (target) onAddToCart(target);
      } else if (data?.clientAction?.type === 'OPEN_PRODUCT' && data.clientAction.productId) {
        const target = products.find((p) => Number(p.id) === Number(data.clientAction.productId));
        if (target) onOpenProduct(target);
      } else if (data?.clientAction?.type === 'FILTER_CATEGORY' && data.clientAction.categorySlug && onFilterCategory) {
        onFilterCategory(data.clientAction.categorySlug);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-err-${Date.now()}`,
          role: 'assistant',
          text: 'Here are our popular stationery items below. Tap any product to add it to your bag!',
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

  const handleVoiceAsk = () => {
    if (listening) {
      stopVoice();
      return;
    }
    const SpeechRecognition =
      typeof window !== 'undefined'
        ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        : null;
    if (!SpeechRecognition) {
      setVoiceStatus('Voice input is unavailable in this browser. Type your question below.');
      return;
    }
    try {
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.lang = 'en-IN';
      recognition.interimResults = true;
      setListening(true);
      setVoiceStatus('Listening... Speak your stationery question.');
      recognition.onresult = (ev: any) => {
        const transcript = Array.from(ev.results || [])
          .map((r: any) => r[0]?.transcript || '')
          .join('')
          .trim();
        if (transcript) {
          setInput(transcript);
          if (ev.results[ev.results.length - 1]?.isFinal) {
            stopVoice();
            sendQuestion(transcript);
          }
        }
      };
      recognition.onerror = () => {
        stopVoice();
        setVoiceStatus('Could not capture audio. Please type below.');
      };
      recognition.onend = () => setListening(false);
      recognition.start();
    } catch {
      setListening(false);
      setVoiceStatus('Could not start microphone.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-end sm:p-4 bg-[#1F1C18]/40 backdrop-blur-sm">
      <div className="w-full sm:max-w-md h-[88vh] sm:h-[680px] liquid-glass rounded-t-[32px] sm:rounded-[32px] flex flex-col overflow-hidden">
        <div className="px-5 py-4 liquid-glass-dark text-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-full bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="font-serif-display text-base font-bold tracking-tight truncate">
                Ask Vidya AI
              </h2>
              <p className="text-[11px] text-[#FCEAE3] truncate">
                Stationery Guide · Coupons &amp; Stock Helper
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Vidya AI"
            className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Prompts Strip */}
        <div className="px-4 py-2.5 bg-[#2C221C]/92 text-white border-b border-white/10 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
          <button
            type="button"
            disabled={loading}
            onClick={() => sendQuestion('Best pens for fast board exam writing under ₹150?')}
            className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded-full text-[11px] whitespace-nowrap inline-flex items-center gap-1 cursor-pointer shrink-0"
          >
            <TrendingUp className="w-3 h-3" />
            <span>Exam Pens</span>
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => sendQuestion('What promo coupons can I apply right now?')}
            className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded-full text-[11px] whitespace-nowrap inline-flex items-center gap-1 cursor-pointer shrink-0"
          >
            <Search className="w-3 h-3" />
            <span>Active Coupons</span>
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => sendQuestion('Recommend art supplies & sketchbooks for students')}
            className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded-full text-[11px] whitespace-nowrap inline-flex items-center gap-1 cursor-pointer shrink-0"
          >
            <Sparkles className="w-3 h-3" />
            <span>Art Studio</span>
          </button>
        </div>

        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => {
            const recProducts = (msg.recommendedProductIds || [])
              .map((id) => products.find((p) => Number(p.id) === Number(id)))
              .filter(Boolean);

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} space-y-2`}
              >
                <div
                  className={`max-w-[90%] px-4 py-3 rounded-[22px] text-xs leading-relaxed whitespace-pre-line ${
                    msg.role === 'user'
                      ? 'liquid-glass-dark text-white rounded-br-xs'
                      : 'liquid-glass-subtle text-[#1F1C18] rounded-bl-xs'
                  }`}
                >
                  {msg.role === 'assistant' && (
                    <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-[#B44C2E] font-bold mb-1">
                      <Bot className="w-3.5 h-3.5" />
                      <span>Vidya AI</span>
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
                </div>

                {recProducts.length > 0 && (
                  <div className="w-full space-y-2 pl-1">
                    {recProducts.map((prod: any) => {
                      const variant = prod.variants?.[0];
                      const price = variant?.sellingPricePaise ?? prod.sellingPricePaise ?? 0;
                      return (
                        <div
                          key={`vidya-rec-${msg.id}-${prod.id}`}
                          className="p-3 liquid-glass rounded-[20px] flex items-center justify-between gap-3"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              onOpenProduct(prod);
                              onClose();
                            }}
                            className="flex items-center gap-2.5 text-left min-w-0 flex-1 cursor-pointer group"
                          >
                            <div className="w-12 h-12 rounded-xl border border-[#E8DFD5] bg-white overflow-hidden shrink-0">
                              <ProductIllustration
                                type={prod.illustrationType}
                                imageUrl={prod.imageUrl}
                                alt={prod.name}
                                className="w-full h-full"
                              />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-[#1F1C18] group-hover:underline truncate">
                                {prod.name}
                              </p>
                              <p className="text-[10px] text-[#5C5349] truncate">
                                {prod.brandName} · {formatPaiseToINR(price)}
                              </p>
                            </div>
                          </button>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {onToggleCompare && (
                              <button
                                type="button"
                                onClick={() => onToggleCompare(Number(prod.id))}
                                className={`px-2 py-1.5 text-[10px] font-semibold rounded-full border cursor-pointer flex items-center gap-1 ${
                                  compareProductIds.includes(Number(prod.id))
                                    ? 'bg-[#B44C2E] text-white border-[#B44C2E]'
                                    : 'bg-white text-[#1F1C18] border-[#E8DFD5]'
                                }`}
                              >
                                <Scale className="w-3 h-3" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => onAddToCart(prod)}
                              className="px-3 py-1.5 liquid-btn-primary text-[11px] font-semibold rounded-full shrink-0 cursor-pointer flex items-center gap-1"
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
                        className="w-full py-2 px-3 liquid-btn-glass text-[11px] font-semibold rounded-full flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Scale className="w-3.5 h-3.5" />
                        <span>Open Comparison ({compareProductIds.length}/3) →</span>
                      </button>
                    )}
                  </div>
                )}

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
                          className="px-3 py-1.5 liquid-btn-glass rounded-full text-[11px] font-medium inline-flex items-center gap-1 cursor-pointer"
                        >
                          <HelpCircle className="w-3 h-3 text-[#B44C2E] shrink-0" />
                          <span className="truncate max-w-[230px]">{fq}</span>
                        </button>
                      ))}
                    </div>
                  )}
              </div>
            );
          })}

          {loading && (
            <div className="flex items-center gap-2 px-4 py-3 liquid-glass-subtle rounded-[20px] w-fit text-xs text-[#8C341B]">
              <Sparkles className="w-3.5 h-3.5 animate-spin" />
              <span>Finding best stationery picks...</span>
            </div>
          )}
        </div>

        {(listening || voiceStatus) && (
          <div className="px-4 py-2 bg-[#FDF2ED] border-t border-[#E8DFD5] text-[11px] text-[#1F1C18] flex items-center justify-between gap-2">
            <span className="truncate font-medium">{voiceStatus || 'Listening...'}</span>
            {listening ? (
              <button
                type="button"
                onClick={stopVoice}
                className="px-2.5 py-0.5 liquid-btn-primary rounded-full text-[10px] font-bold cursor-pointer"
              >
                Stop
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setVoiceStatus(null)}
                className="underline cursor-pointer"
              >
                Dismiss
              </button>
            )}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendQuestion(input);
          }}
          className="p-3 bg-white/75 backdrop-blur-md border-t border-[#E8DFD5] flex items-center gap-2 shrink-0"
        >
          <button
            type="button"
            onClick={handleVoiceAsk}
            aria-label="Voice Input"
            className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 cursor-pointer ${
              listening ? 'liquid-btn-primary animate-pulse' : 'liquid-btn-glass'
            }`}
          >
            {listening ? <Square className="w-3.5 h-3.5 fill-current" /> : <Mic className="w-4 h-4" />}
          </button>

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about pens, coupons, exam kits..."
            className="flex-1 px-4 py-2 text-xs liquid-input rounded-full"
          />

          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="w-9 h-9 rounded-full liquid-btn-primary disabled:opacity-40 flex items-center justify-center shrink-0 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
}
