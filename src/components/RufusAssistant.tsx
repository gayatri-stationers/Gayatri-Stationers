import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, X, ShoppingBag, Mic, ArrowRight, Bot, HelpCircle } from 'lucide-react';
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
  initialQuestion?: string | null;
  onClearInitialQuestion?: () => void;
}

const DEFAULT_STARTER_QUESTIONS = [
  'Best pens for fast board exam writing?',
  'Recommend notebooks & geometry kit under ₹300',
  'What art & craft sets do you have from DOMS?',
  'How does ₹0 Store Pickup counter collection work?',
];

export function RufusAssistant({
  isOpen,
  onClose,
  products,
  activeProduct,
  onAddToCart,
  onOpenProduct,
  onFilterCategory,
  initialQuestion,
  onClearInitialQuestion,
}: RufusAssistantProps) {
  const [messages, setMessages] = useState<RufusChatMessage[]>([
    {
      id: 'welcome-vidya',
      role: 'assistant',
      text: 'Namaste! I’m **Vidya AI**, your Gayatri Stationers Shopping & Study Guide. Ask me to compare pens, find notebooks under your budget, build a complete school exam kit, or add items directly to your cart!',
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
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [messages, loading, isOpen]);

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
          'Here are our top stationery recommendations available for ₹0 Store Pickup and Home Delivery.',
        recommendedProductIds: Array.isArray(data?.recommendedProductIds)
          ? data.recommendedProductIds.map((id: any) => Number(id))
          : [],
        followUpQuestions:
          Array.isArray(data?.followUpQuestions) && data.followUpQuestions.length > 0
            ? data.followUpQuestions
            : DEFAULT_STARTER_QUESTIONS.slice(0, 3),
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

  const handleVoiceAsk = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      return;
    }
    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-IN';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      setListening(true);
      recognition.onresult = (event: any) => {
        const transcript = event?.results?.[0]?.[0]?.transcript || '';
        if (transcript) {
          setInput(transcript);
          sendQuestion(transcript);
        }
        setListening(false);
      };
      recognition.onerror = () => setListening(false);
      recognition.onend = () => setListening(false);
      recognition.start();
    } catch {
      setListening(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-end sm:p-4 bg-slate-950/40 backdrop-blur-xs">
      <div className="w-full sm:max-w-md h-[86vh] sm:h-[680px] bg-white border border-slate-200 rounded-t-[32px] sm:rounded-[32px] shadow-2xl flex flex-col overflow-hidden">
        {/* Header — Vidya AI Brand Bar */}
        <div className="px-5 py-4 bg-gradient-to-r from-slate-900 via-slate-900 to-[#B42318] text-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-full bg-white/15 border border-white/25 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-amber-300" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-serif-display text-base font-bold tracking-tight truncate">
                  Vidya AI
                </h2>
                <span className="px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider bg-amber-400/20 text-amber-200 border border-amber-300/30 rounded-full font-bold">
                  Gayatri Stationers Guide
                </span>
              </div>
              <p className="text-[11px] text-slate-300 truncate">
                Ask anything about notebooks, pens, kits, or prices
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

        {/* Context Banner if viewing a specific product */}
        {activeProduct && (
          <div className="px-4 py-2 bg-amber-50 border-b border-amber-200/80 flex items-center justify-between gap-2 text-[11px] text-amber-950 shrink-0">
            <span className="truncate">
              Asking about: <strong>{activeProduct.name}</strong> (
              {formatPaiseToINR(activeProduct.sellingPricePaise)})
            </span>
            <button
              type="button"
              onClick={() =>
                sendQuestion(`Is ${activeProduct.name} good for school and daily exam use?`)
              }
              className="px-2.5 py-0.5 bg-amber-900 text-white rounded-full text-[10px] font-semibold shrink-0 cursor-pointer"
            >
              Ask Review
            </button>
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
                  className={`max-w-[88%] px-4 py-3 rounded-[24px] text-xs leading-relaxed whitespace-pre-line shadow-2xs ${
                    msg.role === 'user'
                      ? 'bg-slate-900 text-white rounded-br-xs'
                      : 'bg-white border border-slate-200/90 text-slate-800 rounded-bl-xs'
                  }`}
                >
                  {msg.role === 'assistant' && (
                    <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-[#B42318] font-bold mb-1">
                      <Bot className="w-3.5 h-3.5" />
                      <span>Vidya AI · Gayatri Stationers Guide</span>
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
                          className="p-3 bg-white border border-slate-200/90 rounded-[22px] shadow-2xs flex items-center justify-between gap-3"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              onOpenProduct(prod);
                              onClose();
                            }}
                            className="flex items-center gap-2.5 text-left min-w-0 flex-1 cursor-pointer group"
                          >
                            <div className="w-12 h-12 rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden shrink-0">
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

                          <button
                            type="button"
                            onClick={() => onAddToCart(prod)}
                            className="px-3.5 py-2 bg-[#B42318] hover:bg-[#991B1B] text-white text-[11px] font-semibold rounded-full shrink-0 cursor-pointer flex items-center gap-1 shadow-2xs"
                          >
                            <ShoppingBag className="w-3 h-3" />
                            <span>+ Add</span>
                          </button>
                        </div>
                      );
                    })}
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
            <div className="flex items-center gap-2 px-4 py-3 bg-white border border-slate-200 rounded-[22px] w-fit text-xs text-slate-600 shadow-2xs">
              <Sparkles className="w-3.5 h-3.5 text-[#B42318] animate-spin" />
              <span>Vidya AI is checking Gayatri Stationers catalogue...</span>
            </div>
          )}
        </div>

        {/* Input Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendQuestion(input);
          }}
          className="p-3 bg-white border-t border-slate-200 flex items-center gap-2 shrink-0"
        >
          <button
            type="button"
            onClick={handleVoiceAsk}
            title="Speak to Vidya AI"
            className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 cursor-pointer transition-colors ${
              listening
                ? 'bg-red-600 text-white animate-pulse'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <Mic className="w-4 h-4" />
          </button>

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Vidya AI a question or 'Add Classmate notebook'..."
            className="flex-1 px-4 py-2 text-xs bg-slate-100 focus:bg-white border border-slate-200 focus:border-slate-900 rounded-full focus:outline-none text-slate-900"
          />

          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="w-9 h-9 rounded-full bg-[#B42318] hover:bg-[#991B1B] disabled:opacity-40 text-white flex items-center justify-center shrink-0 cursor-pointer transition-colors shadow-2xs"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
}
