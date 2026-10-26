/**
 * WEALTHY-WHALES VIDEO ACADEMY & LMS SERVICE
 * ─────────────────────────────────────────────────────────────────────────────
 * Manages courses, lessons, watch progress, and UPI / UTR enrollments.
 */

import { db } from "./db";
import { courses, courseLessons, courseEnrollments, lessonProgress } from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";

export interface CourseWithLessons {
  id: string;
  title: string;
  slug: string;
  description: string;
  thumbnailUrl: string;
  priceInr: number;
  level: "Beginner" | "Intermediate" | "Institutional";
  isPublished: boolean;
  totalDurationMinutes: number;
  lessonsCount: number;
  lessons: Array<{
    id: string;
    courseId: string;
    title: string;
    description: string;
    videoUrl: string;
    durationSeconds: number;
    orderIndex: number;
    isFreePreview: boolean;
    strategyTemplateJson: any;
    pdfNotesUrl: string | null;
  }>;
}

// In-memory initial curriculum
const SEED_COURSES: CourseWithLessons[] = [
  {
    id: "course-1",
    title: "Institutional VCP Masterclass: Coiling, Pivots & Position Sizing",
    slug: "institutional-vcp-masterclass",
    description: "Master the Volatility Contraction Pattern (VCP) used by US Investing Champions. Learn progressive contractions, volume dry-up, cheat entries, and institutional risk management.",
    thumbnailUrl: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&auto=format&fit=crop&q=80",
    priceInr: 2999,
    level: "Institutional",
    isPublished: true,
    totalDurationMinutes: 185,
    lessonsCount: 4,
    lessons: [
      {
        id: "lesson-1-1",
        courseId: "course-1",
        title: "The Anatomy of a High-Tight Flag & VCP Base",
        description: "Understanding Stage 2 uptrends, contraction depth sequences, and the 50-day moving average rising test.",
        videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
        durationSeconds: 1620,
        orderIndex: 1,
        isFreePreview: true,
        strategyTemplateJson: {
          strategyId: "template-1",
          name: "MarketSmith RS 80+ & VCP Breakout",
          rules: ["RS_RATING >= 80", "VCP_CONTRACTIONS >= 2", "VOLUME >= 1.4x SMA20"]
        },
        pdfNotesUrl: "/notes/vcp-anatomy.pdf"
      },
      {
        id: "lesson-1-2",
        courseId: "course-1",
        title: "Volume Dry-Up (VDU) & Pivot Breakout Mechanics",
        description: "How to identify supply exhaustion before the breakout bar prints. Real NSE case studies on Tata Motors and Dixon.",
        videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
        durationSeconds: 2400,
        orderIndex: 2,
        isFreePreview: false,
        strategyTemplateJson: {
          strategyId: "template-1",
          name: "VDU Cheat Entry Scanner"
        },
        pdfNotesUrl: "/notes/vdu-mechanics.pdf"
      },
      {
        id: "lesson-1-3",
        courseId: "course-1",
        title: "Asymmetric Risk-Reward: Stop Loss & Scaling Out",
        description: "Never risk more than 1.5x daily ATR. Structuring 1:2.5 to 1:5 risk-reward swings and locking in partial profits.",
        videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
        durationSeconds: 3100,
        orderIndex: 3,
        isFreePreview: false,
        strategyTemplateJson: null,
        pdfNotesUrl: "/notes/risk-architecture.pdf"
      },
      {
        id: "lesson-1-4",
        courseId: "course-1",
        title: "Live Scanner Deployment & TradingView Chart Plotting",
        description: "Connecting Hermes VCP signals directly into your daily morning routine and live chart alerts.",
        videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
        durationSeconds: 3900,
        orderIndex: 4,
        isFreePreview: false,
        strategyTemplateJson: {
          strategyId: "template-1",
          name: "Hermes High-Conviction Breakout"
        },
        pdfNotesUrl: "/notes/chart-deployment.pdf"
      }
    ]
  },
  {
    id: "course-2",
    title: "Intraday F&O Flow Dynamics: Multi-EMA Ribbons & OI Walls",
    slug: "intraday-fo-flow-dynamics",
    description: "Decode live Open Interest buildup, Put-Call Ratio extremes, Max Pain pinning, and 9/20/50 EMA pullback retests for high-probability option trading.",
    thumbnailUrl: "https://images.unsplash.com/photo-1642543492481-44e81e3914a7?w=800&auto=format&fit=crop&q=80",
    priceInr: 3999,
    level: "Institutional",
    isPublished: true,
    totalDurationMinutes: 145,
    lessonsCount: 3,
    lessons: [
      {
        id: "lesson-2-1",
        courseId: "course-2",
        title: "Institutional Positioning: Long Buildup vs Short Covering",
        description: "Dissecting the 4 quadrant OI-Price matrix and filtering genuine institutional block trades from retail noise.",
        videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
        durationSeconds: 1800,
        orderIndex: 1,
        isFreePreview: true,
        strategyTemplateJson: {
          strategyId: "template-3",
          name: "Intraday F&O 20 EMA Retest + Long Buildup"
        },
        pdfNotesUrl: "/notes/fo-positioning.pdf"
      },
      {
        id: "lesson-2-2",
        courseId: "course-2",
        title: "Multi-EMA Ribbon Retest (5m & 15m Trend Continuation)",
        description: "Rules for trading the 9 EMA shallow dip and 20 EMA mean reversion during strong market impulses.",
        videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
        durationSeconds: 2700,
        orderIndex: 2,
        isFreePreview: false,
        strategyTemplateJson: {
          strategyId: "template-3",
          name: "EMA Ribbon 15m Retest"
        },
        pdfNotesUrl: "/notes/ema-ribbon-rules.pdf"
      },
      {
        id: "lesson-2-3",
        courseId: "course-2",
        title: "OI Resistance Walls & Exhaustion Mean Reversal Squeezes",
        description: "Trading against the herd when stock is overextended > 2.2 ATR into heavy Call or Put OI walls.",
        videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
        durationSeconds: 4200,
        orderIndex: 3,
        isFreePreview: false,
        strategyTemplateJson: {
          strategyId: "template-4",
          name: "OI-Wall Exhaustion Reversal Squeeze"
        },
        pdfNotesUrl: "/notes/oi-wall-reversal.pdf"
      }
    ]
  },
  {
    id: "course-3",
    title: "Quantitative Factor Investing: Qlib Alpha158 & Screener.in Quality",
    slug: "quantitative-factor-investing",
    description: "Learn how hedge funds screen multibaggers: combining Microsoft Qlib KBAR momentum, MarketSmith 1-99 RS rank, and debt-free ROCE compounders.",
    thumbnailUrl: "https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?w=800&auto=format&fit=crop&q=80",
    priceInr: 1999,
    level: "Intermediate",
    isPublished: true,
    totalDurationMinutes: 120,
    lessonsCount: 2,
    lessons: [
      {
        id: "lesson-3-1",
        courseId: "course-3",
        title: "MarketSmith RS Rating Formula (3M/6M/9M/12M Weighted)",
        description: "Replicating William O'Neil's proprietary relative strength calculation without paying ₹40,000/year for software.",
        videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
        durationSeconds: 2100,
        orderIndex: 1,
        isFreePreview: true,
        strategyTemplateJson: {
          strategyId: "template-1",
          name: "MarketSmith RS 80+ & VCP Breakout"
        },
        pdfNotesUrl: "/notes/rs-formula.pdf"
      },
      {
        id: "lesson-3-2",
        courseId: "course-3",
        title: "Screener.in Fundamental Multi-Filters (ROCE, ROE, FCF & Promoters)",
        description: "How to screen out value traps and identify earnings acceleration before the street catches on.",
        videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
        durationSeconds: 2900,
        orderIndex: 2,
        isFreePreview: false,
        strategyTemplateJson: {
          strategyId: "template-2",
          name: "Screener.in High ROCE Quality Compounders"
        },
        pdfNotesUrl: "/notes/fundamental-screener.pdf"
      }
    ]
  }
];

// In-memory cache for enrollments and progress
const enrollmentsStore = new Map<string, {
  id: string;
  userId: string;
  userEmail?: string;
  courseId: string;
  paymentStatus: "PENDING" | "PAID" | "GRANTED";
  utrOrTransactionId: string;
  enrolledAt: string;
}>();

const lessonProgressStore = new Map<string, {
  userId: string;
  lessonId: string;
  watchedSeconds: number;
  isCompleted: boolean;
  updatedAt: string;
}>();

/**
 * Returns all published courses with lesson counts
 */
export async function getAllCourses(userId?: string): Promise<CourseWithLessons[]> {
  try {
    const dbCourses = await db.select().from(courses);
    if (dbCourses.length > 0) {
      // Map DB courses
      return SEED_COURSES;
    }
  } catch (_) {}
  return SEED_COURSES;
}

/**
 * Returns course by slug with lessons, progress, and enrollment status for the user
 */
export async function getCourseBySlug(slug: string, userId?: string) {
  const course = SEED_COURSES.find(c => c.slug === slug || c.id === slug);
  if (!course) return null;

  // Check enrollment
  let isEnrolled = false;
  let paymentStatus: "PENDING" | "PAID" | "GRANTED" | "UNENROLLED" = "UNENROLLED";

  if (userId) {
    const enrollmentKey = `${userId}:${course.id}`;
    const enrollment = enrollmentsStore.get(enrollmentKey);
    if (enrollment) {
      paymentStatus = enrollment.paymentStatus;
      isEnrolled = enrollment.paymentStatus === "PAID" || enrollment.paymentStatus === "GRANTED";
    }
  }

  // Attach progress per lesson
  const lessonsWithProgress = course.lessons.map(lesson => {
    let progress = { watchedSeconds: 0, isCompleted: false };
    if (userId) {
      const p = lessonProgressStore.get(`${userId}:${lesson.id}`);
      if (p) progress = { watchedSeconds: p.watchedSeconds, isCompleted: p.isCompleted };
    }

    // Protect video URL if not free preview and not enrolled
    const accessible = lesson.isFreePreview || isEnrolled;

    return {
      ...lesson,
      videoUrl: accessible ? lesson.videoUrl : "",
      isLocked: !accessible,
      progress,
    };
  });

  return {
    ...course,
    isEnrolled,
    paymentStatus,
    lessons: lessonsWithProgress,
  };
}

/**
 * Submits an enrollment with UPI UTR transaction ID
 */
export async function submitEnrollment(
  userId: string,
  courseId: string,
  utrOrTransactionId: string,
  userEmail?: string,
) {
  const enrollmentId = `enr-${Date.now()}`;
  const record = {
    id: enrollmentId,
    userId,
    userEmail: userEmail || "trader@wealthywhales.in",
    courseId,
    paymentStatus: "PENDING" as const,
    utrOrTransactionId: utrOrTransactionId.trim(),
    enrolledAt: new Date().toISOString(),
  };

  const key = `${userId}:${courseId}`;
  enrollmentsStore.set(key, record);

  try {
    const cId = parseInt(courseId.replace(/\D/g, "")) || 1;
    await db.insert(courseEnrollments).values({
      userId,
      courseId: cId,
      paymentStatus: "PENDING",
      utrOrTransactionId: utrOrTransactionId.trim(),
    });
  } catch (_) {}

  return { success: true, enrollment: record };
}

/**
 * Updates lesson watch progress
 */
export async function updateLessonProgress(
  userId: string,
  lessonId: string,
  watchedSeconds: number,
  isCompleted: boolean,
) {
  const key = `${userId}:${lessonId}`;
  const record = {
    userId,
    lessonId,
    watchedSeconds,
    isCompleted,
    updatedAt: new Date().toISOString(),
  };
  lessonProgressStore.set(key, record);

  try {
    const lId = parseInt(lessonId.replace(/\D/g, "")) || 1;
    await db.insert(lessonProgress).values({
      userId,
      lessonId: lId,
      watchedSeconds,
      isCompleted,
    });
  } catch (_) {}

  return { success: true, progress: record };
}

/**
 * Admin: Get all enrollments
 */
export async function getAllEnrollments() {
  const list = Array.from(enrollmentsStore.values());
  return list.sort((a, b) => new Date(b.enrolledAt).getTime() - new Date(a.enrolledAt).getTime());
}

/**
 * Admin: Grant or approve enrollment
 */
export async function approveEnrollment(enrollmentId: string, status: "PAID" | "GRANTED") {
  for (const [key, enr] of enrollmentsStore.entries()) {
    if (enr.id === enrollmentId || enr.utrOrTransactionId === enrollmentId) {
      enr.paymentStatus = status;
      enrollmentsStore.set(key, enr);
      return { success: true, enrollment: enr };
    }
  }
  return { success: false, error: "Enrollment not found" };
}
