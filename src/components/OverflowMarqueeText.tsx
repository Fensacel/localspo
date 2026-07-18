import { useEffect, useRef, useState, type CSSProperties } from 'react';

interface OverflowMarqueeTextProps {
  text: string;
  className?: string;
}

export function OverflowMarqueeText({ text, className }: OverflowMarqueeTextProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLSpanElement | null>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [distance, setDistance] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;

    const measure = () => {
      const overflow = content.scrollWidth > container.clientWidth + 1;
      setIsOverflowing(overflow);
      setDistance(Math.max(content.scrollWidth + 24, 0));
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(container);
    observer.observe(content);
    window.addEventListener('resize', measure);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [text]);

  const duration = Math.max(distance / 32, 8);

  return (
    <div ref={containerRef} className={`overflow-hidden whitespace-nowrap ${className ?? ''}`}>
      <div
        className={isOverflowing ? 'bt-marquee-track inline-flex items-center' : 'inline-flex items-center'}
        style={
          isOverflowing
            ? ({
                ['--bt-marquee-distance' as string]: `${distance}px`,
                ['--bt-marquee-duration' as string]: `${duration}s`,
              } as CSSProperties)
            : undefined
        }
      >
        <span ref={contentRef} className="inline-block">
          {text}
        </span>
        {isOverflowing && (
          <span aria-hidden className="inline-block pl-6">
            {text}
          </span>
        )}
      </div>
    </div>
  );
}
