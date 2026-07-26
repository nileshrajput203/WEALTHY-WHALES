import { ReactNode, useRef } from "react";
import { motion, useInView } from "framer-motion";
import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────────
   BentoGrid
   A CSS grid wrapper that sets row/column constraints.
───────────────────────────────────────────────────────────── */
export const BentoGrid = ({
  className,
  children,
}: {
  className?: string;
  children?: ReactNode;
}) => {
  return (
    <div
      className={cn(
        "grid md:auto-rows-[20rem] grid-cols-1 md:grid-cols-3 gap-4 max-w-7xl mx-auto",
        className
      )}
    >
      {children}
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
   BentoGridItem
   Premium glassmorphism card with:
   - Staggered scroll-reveal via framer-motion useInView
   - Subtle 3-D perspective tilt on hover (rotateX / rotateY)
   - Glowing border + icon halo on hover
   - Top-edge light stripe for depth
───────────────────────────────────────────────────────────── */
export const BentoGridItem = ({
  className,
  title,
  description,
  header,
  icon,
  index = 0,
}: {
  className?: string;
  title?: string | ReactNode;
  description?: string | ReactNode;
  header?: ReactNode;
  icon?: ReactNode;
  index?: number;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <motion.div
      ref={ref}
      /* ── Scroll-reveal ── */
      initial={{ opacity: 0, y: 32 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 32 }}
      transition={{
        duration: 0.55,
        delay: index * 0.07,
        ease: [0.16, 1, 0.3, 1],
      }}
      /* ── 3-D hover tilt ── */
      whileHover={{
        scale: 1.025,
        rotateX: 2,
        rotateY: 1.5,
        transition: { type: "spring", stiffness: 350, damping: 22 },
      }}
      style={{ perspective: 800, transformStyle: "preserve-3d" }}
      className={cn(
        /* Base glass card */
        "group/bento relative row-span-1 flex flex-col justify-between",
        "rounded-2xl p-5 overflow-hidden",
        "glass-card",
        /* Border — transitions to glow-border on hover */
        "border border-white/6",
        "hover:border-primary/30",
        /* Glow shadow on hover */
        "transition-all duration-300",
        "hover:[box-shadow:0_0_0_1px_hsl(260_84%_65%_/_0.35),_0_0_24px_0px_hsl(260_84%_65%_/_0.15),_0_8px_32px_0px_hsl(0_0%_0%_/_0.6)]",
        "[box-shadow:0_2px_16px_0px_hsl(0_0%_0%_/_0.4)]",
        className
      )}
    >
      {/* ── Top edge light stripe ─────────────── */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none" />

      {/* ── Hover radial glow overlay ────────── */}
      <div
        className="absolute inset-0 opacity-0 group-hover/bento:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl"
        style={{
          background:
            "radial-gradient(ellipse at 50% 0%, hsl(260 84% 65% / 0.08) 0%, transparent 65%)",
        }}
      />

      {/* ── Header area (visual preview) ─────── */}
      <div className="flex-1 mb-4 rounded-xl overflow-hidden relative">
        {header}
      </div>

      {/* ── Text content (slides right on hover) */}
      <div className="group-hover/bento:translate-x-1.5 transition-transform duration-300 z-10 space-y-1.5">
        {/* Icon with glowing halo */}
        <div
          className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-white/5 border border-white/8
            group-hover/bento:bg-primary/15 group-hover/bento:border-primary/30
            group-hover/bento:[box-shadow:0_0_12px_2px_hsl(260_84%_65%_/_0.2)]
            transition-all duration-300 mb-2"
        >
          {icon}
        </div>

        <div className="font-display font-semibold text-white/90 text-sm leading-snug">
          {title}
        </div>

        <div className="font-sans text-white/45 text-xs leading-relaxed">
          {description}
        </div>
      </div>
    </motion.div>
  );
};
