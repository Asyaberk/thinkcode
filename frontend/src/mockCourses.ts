/**
 * mockCourses.ts
 *
 * CourseSelectionPage için görsel zenginlik sağlayan statik veriler.
 * id alanları backend'deki class_id'lerle eşleştirilir (useCourses hook'u inject eder).
 * thumbnail ve color alanları tamamen UI amaçlı — DB'ye yazılmaz.
 *
 * Gerçek class listesi backend'den gelir; bu dosya sadece
 * "class_code → görsel metadata" mapping'i sağlar.
 */

export const COURSE_VISUALS: Record<string, { thumbnail: string; color: string; description: string }> = {
  CMPE211: {
    color: '#10b981',
    thumbnail: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&auto=format&fit=crop&q=60',
    description: 'Fundamental data structures and algorithm design techniques including sorting, searching, graphs, and complexity analysis.',
  },
  CS204: {
    color: '#6366f1',
    thumbnail: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&auto=format&fit=crop&q=60',
    description: 'Low-level programming, memory management, process control, and operating system interfaces in C and C++.',
  },
  CMPE321: {
    color: '#f59e0b',
    thumbnail: 'https://images.unsplash.com/photo-1544383835-bda2bc66a55d?w=800&auto=format&fit=crop&q=60',
    description: 'Relational database design, SQL, transactions, indexing, and query optimization principles.',
  },
  CMPE436: {
    color: '#ec4899',
    thumbnail: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&auto=format&fit=crop&q=60',
    description: 'Distributed systems fundamentals — consensus, replication, fault tolerance, and microservices architecture.',
  },
  DEFAULT: {
    color: '#10b981',
    thumbnail: '',
    description: 'Course content managed through ThinkCode platform.',
  },
};

/** Bir class_code'a göre görsel metadata döndürür, bulunamazsa DEFAULT kullanır */
export function getCourseVisuals(code: string) {
  return COURSE_VISUALS[code.toUpperCase()] ?? COURSE_VISUALS['DEFAULT'];
}
