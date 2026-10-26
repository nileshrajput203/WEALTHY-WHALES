import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  GraduationCap,
  Play,
  Lock,
  CheckCircle,
  FileText,
  Sliders,
  QrCode,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Clock,
  Sparkles,
  Award,
} from "lucide-react";
import { Link, useLocation } from "wouter";

interface Lesson {
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
  isLocked: boolean;
  progress?: {
    watchedSeconds: number;
    isCompleted: boolean;
  };
}

interface Course {
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
  isEnrolled: boolean;
  paymentStatus: "PENDING" | "PAID" | "GRANTED" | "UNENROLLED";
  lessons: Lesson[];
}

export default function Academy() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [selectedCourseSlug, setSelectedCourseSlug] = useState<string>("institutional-vcp-masterclass");
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [utrNumber, setUtrNumber] = useState("");
  const [enrolledEmail, setEnrolledEmail] = useState("");

  // Fetch all courses
  const { data: coursesList, isLoading } = useQuery<Course[]>({
    queryKey: ["/api/academy/courses"],
  });

  // Fetch active course details
  const { data: activeCourse } = useQuery<Course>({
    queryKey: ["/api/academy/courses", selectedCourseSlug],
    queryFn: async () => {
      const res = await fetch(`/api/academy/courses/${selectedCourseSlug}`);
      return res.json();
    },
    enabled: !!selectedCourseSlug,
  });

  // Payment enrollment mutation
  const enrollMutation = useMutation({
    mutationFn: async ({ courseId, utr, email }: { courseId: string; utr: string; email: string }) => {
      const res = await fetch("/api/academy/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId,
          utrOrTransactionId: utr,
          userEmail: email,
        }),
      });
      return res.json();
    },
    onSuccess: () => {
      setShowPaymentModal(false);
      setUtrNumber("");
      queryClient.invalidateQueries({ queryKey: ["/api/academy/courses"] });
      alert("Payment proof submitted! Your 12-digit UTR has been sent for admin verification.");
    },
  });

  const currentCourse = activeCourse || coursesList?.[0];
  const activeLesson = currentCourse?.lessons?.find((l) => l.id === activeLessonId) || currentCourse?.lessons?.[0];

  const handleLessonSelect = (lesson: Lesson) => {
    if (lesson.isLocked) {
      setShowPaymentModal(true);
    } else {
      setActiveLessonId(lesson.id);
    }
  };

  const handleLoadStrategy = (template: any) => {
    setLocation("/strategy-builder");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <GraduationCap className="w-6 h-6 text-primary" />
            <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-white">
              Institutional Video Academy & LMS
            </h1>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              ZERO-COMMISSION UPI UNLOCK
            </span>
          </div>
          <p className="text-sm text-white/50 font-sans">
            MasterClass curriculum covering VCP coiling, F&O order flow, and quantitative factor modeling with executable scanner templates.
          </p>
        </div>
      </div>

      {/* Courses Catalog Carousel / Tabs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {coursesList?.map((course) => {
          const isSelected = course.slug === selectedCourseSlug;
          return (
            <div
              key={course.id}
              onClick={() => {
                setSelectedCourseSlug(course.slug);
                setActiveLessonId(null);
              }}
              className={`glass-card rounded-2xl p-4 border transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between ${
                isSelected
                  ? "border-primary/60 bg-primary/5 shadow-lg shadow-primary/10"
                  : "border-white/8 hover:border-white/20"
              }`}
            >
              <div>
                <div className="relative h-32 rounded-xl overflow-hidden mb-3">
                  <img
                    src={course.thumbnailUrl}
                    alt={course.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-black/80 backdrop-blur text-white border border-white/20">
                    {course.level}
                  </div>
                </div>

                <h3 className="font-display font-bold text-white text-sm mb-1 leading-snug">
                  {course.title}
                </h3>
                <p className="text-xs text-white/40 line-clamp-2 font-sans mb-3">
                  {course.description}
                </p>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-white/5 text-xs font-mono">
                <span className="text-white/50">{course.lessonsCount} Modules · {course.totalDurationMinutes}m</span>
                <span className="font-bold text-emerald-400">₹{course.priceInr}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Course Player & Lesson Grid */}
      {currentCourse && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Video Viewport (2 Cols) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="glass-card rounded-2xl border border-white/8 overflow-hidden bg-black/60 relative">
              {activeLesson && !activeLesson.isLocked ? (
                <div className="relative aspect-video w-full bg-black">
                  <iframe
                    src={activeLesson.videoUrl}
                    title={activeLesson.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="w-full h-full border-0"
                  />
                </div>
              ) : (
                <div className="aspect-video w-full flex flex-col items-center justify-center p-6 text-center bg-black/90 relative">
                  <Lock className="w-12 h-12 text-primary mb-3" />
                  <h3 className="text-lg font-display font-bold text-white mb-1">
                    Premium Institutional Lesson
                  </h3>
                  <p className="text-xs text-white/50 max-w-sm font-sans mb-4">
                    Unlock full access with lifetime updates using our zero-cost direct UPI QR payment.
                  </p>
                  <button
                    onClick={() => setShowPaymentModal(true)}
                    className="px-5 py-2.5 rounded-xl text-xs font-mono font-bold bg-primary hover:bg-primary/90 text-black transition-all shadow-md shadow-primary/20"
                  >
                    Unlock Course for ₹{currentCourse.priceInr}
                  </button>
                </div>
              )}

              {/* Lesson Metadata */}
              {activeLesson && (
                <div className="p-5">
                  <div className="flex items-center justify-between gap-4 mb-2">
                    <h2 className="text-lg font-display font-bold text-white">
                      {activeLesson.orderIndex}. {activeLesson.title}
                    </h2>
                    {activeLesson.isFreePreview && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold whitespace-nowrap">
                        FREE PREVIEW
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-white/60 font-sans leading-relaxed mb-4">
                    {activeLesson.description}
                  </p>

                  {/* Attached Strategy Action Button */}
                  {activeLesson.strategyTemplateJson && (
                    <div className="p-3 rounded-xl bg-white/3 border border-white/8 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-white">
                          <Sliders className="w-3.5 h-3.5 text-primary" />
                          Attached Strategy Template: {activeLesson.strategyTemplateJson.name}
                        </div>
                        <p className="text-[11px] text-white/40 font-sans">
                          Load this lesson's exact rules directly into the live Strategy Scanner.
                        </p>
                      </div>

                      <button
                        onClick={() => handleLoadStrategy(activeLesson.strategyTemplateJson)}
                        className="px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold bg-white/5 hover:bg-primary text-white hover:text-black border border-white/10 transition-colors whitespace-nowrap flex items-center gap-1"
                      >
                        Try Live in Scanner <Sparkles className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Curriculum Sidebar (1 Col) */}
          <div className="glass-card rounded-2xl border border-white/8 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="font-display font-bold text-white text-sm">Course Curriculum</h3>
                <p className="text-[11px] font-mono text-white/40">{currentCourse.lessonsCount} Modules</p>
              </div>

              {currentCourse.paymentStatus === "PENDING" ? (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold">
                  VERIFICATION PENDING
                </span>
              ) : currentCourse.isEnrolled ? (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                  ENROLLED
                </span>
              ) : (
                <button
                  onClick={() => setShowPaymentModal(true)}
                  className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-primary text-black"
                >
                  Enroll ₹{currentCourse.priceInr}
                </button>
              )}
            </div>

            {/* Lessons List */}
            <div className="space-y-2">
              {currentCourse.lessons.map((lesson) => {
                const isActive = lesson.id === activeLesson?.id;
                const isLocked = lesson.isLocked;

                return (
                  <button
                    key={lesson.id}
                    onClick={() => handleLessonSelect(lesson)}
                    className={`w-full text-left p-3 rounded-xl border transition-all flex items-start gap-3 ${
                      isActive
                        ? "bg-primary/10 border-primary/40 text-white"
                        : "bg-white/2 border-white/5 hover:bg-white/5 text-white/70"
                    }`}
                  >
                    <div className="mt-0.5">
                      {isLocked ? (
                        <Lock className="w-4 h-4 text-white/30" />
                      ) : (
                        <Play className={`w-4 h-4 ${isActive ? "text-primary fill-primary" : "text-white/40"}`} />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono font-bold truncate text-white">
                        {lesson.orderIndex}. {lesson.title}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] font-mono text-white/40 mt-1">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {Math.round(lesson.durationSeconds / 60)}m
                        </span>
                        {lesson.isFreePreview && (
                          <span className="text-emerald-400 font-bold">Free Preview</span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Zero-Cost UPI Payment QR Modal */}
      {showPaymentModal && currentCourse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="glass-card rounded-2xl border border-white/10 p-6 max-w-md w-full bg-[#0F1422] shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="text-base font-display font-bold text-white">Unlock Lifetime Access</h3>
                <p className="text-xs font-mono text-white/40">{currentCourse.title}</p>
              </div>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="text-white/40 hover:text-white font-mono text-sm"
              >
                ✕
              </button>
            </div>

            {/* UPI QR Code Generation */}
            <div className="p-4 rounded-xl bg-white flex flex-col items-center justify-center text-center">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=upi://pay?pa=wealthywhales@upi&pn=WealthyWhales&am=${currentCourse.priceInr}&cu=INR`}
                alt="UPI Payment QR"
                className="w-44 h-44 mb-2"
              />
              <p className="text-xs font-mono font-bold text-gray-800">Scan via GPay, PhonePe or Paytm</p>
              <p className="text-[11px] font-mono text-gray-500">Amount: ₹{currentCourse.priceInr} · VPA: wealthywhales@upi</p>
            </div>

            {/* 12-Digit UTR Submission Form */}
            <div className="space-y-3">
              <div>
                <label className="text-xs font-mono text-white/60 block mb-1">
                  Your Email Address
                </label>
                <input
                  type="email"
                  value={enrolledEmail}
                  onChange={(e) => setEnrolledEmail(e.target.value)}
                  placeholder="trader@gmail.com"
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 font-sans text-xs text-white focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="text-xs font-mono text-white/60 block mb-1">
                  12-Digit UPI Transaction / UTR Number
                </label>
                <input
                  type="text"
                  maxLength={12}
                  value={utrNumber}
                  onChange={(e) => setUtrNumber(e.target.value)}
                  placeholder="e.g. 412345678901"
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 font-mono text-xs text-emerald-400 focus:outline-none focus:border-primary font-bold tracking-widest"
                />
              </div>

              <button
                onClick={() =>
                  enrollMutation.mutate({
                    courseId: currentCourse.id,
                    utr: utrNumber,
                    email: enrolledEmail,
                  })
                }
                disabled={utrNumber.length < 6 || enrollMutation.isPending}
                className="w-full py-2.5 rounded-xl font-mono text-xs font-bold bg-primary hover:bg-primary/90 text-black transition-all disabled:opacity-50"
              >
                {enrollMutation.isPending ? "Submitting Proof..." : "Submit UTR & Activate Access"}
              </button>

              <p className="text-[10px] font-mono text-center text-white/30">
                Direct peer-to-peer verification. No payment gateway charges or credit card needed.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
