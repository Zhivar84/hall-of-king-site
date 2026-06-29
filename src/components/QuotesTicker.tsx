import React, { useState, useEffect } from "react";
import { Sparkles, Quote } from "lucide-react";

interface QuoteType {
  id: string;
  text: string;
  author: string;
  submittedBy: string;
}

export default function QuotesTicker() {
  const [quotes, setQuotes] = useState<QuoteType[]>([]);
  const [tickerText, setTickerText] = useState<string>("");

  const defaultQuotes: QuoteType[] = [
    {
      id: "d1",
      text: "به تالار پادشاهان خوش آمدید! سخنان گرانبهای خود را در تالار بزرگان ثبت کنید تا در این نوار نمایش داده شود.",
      author: "سیستم",
      submittedBy: "مدیر",
    },
    {
      id: "d2",
      text: "اندیشیدن دشوار است، به همین خاطر است که بیشتر مردم قضاوت می‌کنند.",
      author: "کارل گوستاو یونگ",
      submittedBy: "آرش",
    },
    {
      id: "d3",
      text: "اگر می‌خواهی پرواز کنی، باید تمام چیزهایی که تو را به زمین زنجیر کرده‌اند رها کنی.",
      author: "تونی موریسون",
      submittedBy: "شاهان",
    }
  ];

  const fetchQuotes = async () => {
    try {
      const res = await fetch("/api/quotes");
      if (res.ok) {
        const data = await res.json();
        if (data.quotes && data.quotes.length > 0) {
          setQuotes(data.quotes);
        } else {
          setQuotes(defaultQuotes);
        }
      } else {
        setQuotes(defaultQuotes);
      }
    } catch (err) {
      console.warn("Could not fetch quotes for ticker, using default quotes:", err);
      setQuotes(defaultQuotes);
    }
  };

  useEffect(() => {
    fetchQuotes();
    // Refresh quotes every 20 seconds to catch new quotes
    const interval = setInterval(fetchQuotes, 20000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (quotes.length === 0) return;

    // Shuffle and pick up to 10 quotes to show in the continuous marquee loop
    const shuffled = [...quotes].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 10);

    const formattedText = selected
      .map(q => `« ${q.text} » — ${q.author} (فرستنده: ${q.submittedBy})`)
      .join("      ✦      ");

    setTickerText(formattedText);
  }, [quotes]);

  if (!tickerText) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 h-8 bg-zinc-950/95 backdrop-blur-md border-t border-purple-900/30 flex items-center justify-between overflow-hidden z-50 select-none" dir="rtl">
      {/* Styled Side Label Indicator */}
      <div className="h-full bg-purple-950/80 hover:bg-purple-900 text-purple-300 px-3.5 flex items-center gap-1.5 text-[11px] font-extrabold border-l border-purple-900/30 shadow-[rgba(0,0,0,0.5)_5px_0_15px] shrink-0 relative z-20">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        <Quote className="w-3 h-3 text-purple-400" />
        <span>سخن بزرگان</span>
      </div>

      {/* Dynamic Marquee Track - forcing LTR container for seamless CSS translation */}
      <div className="flex-1 overflow-hidden relative h-full flex items-center pl-4" dir="ltr">
        {/* Left Fade-out shadow overlay */}
        <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-zinc-950 via-zinc-950/80 to-transparent z-10 pointer-events-none" />
        
        {/* Marquee Scrolling Content */}
        <div className="whitespace-nowrap inline-block animate-marquee-custom text-[11px] text-zinc-300 font-medium py-1">
          {tickerText}
        </div>
      </div>

      {/* Inline style tag for custom marquee performance with hardware acceleration */}
      <style>{`
        @keyframes marqueeCustom {
          0% {
            transform: translate3d(100vw, 0, 0);
          }
          100% {
            transform: translate3d(-100%, 0, 0);
          }
        }
        .animate-marquee-custom {
          display: inline-block;
          animation: marqueeCustom 55s linear infinite;
          will-change: transform;
        }
      `}</style>
    </div>
  );
}
