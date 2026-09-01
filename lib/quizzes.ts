import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { isLeader, readAccessRole } from "@/lib/access";
import { getSql } from "@/lib/db";

export type QuestionType = "short" | "long" | "choice";

export type QuizQuestion = {
  id: string;
  prompt: string;
  type: QuestionType;
  choices?: string[];
};

export type Quiz = {
  id: string;
  title: string;
  lessonSlug: string;
  intro: string;
  questions: QuizQuestion[];
  sortOrder: number;
};

export type QuizAnswer = { questionId: string; prompt?: string; value: string };

export type QuizResponse = {
  id: string;
  quizId: string;
  quizTitle: string;
  lessonSlug: string;
  userId: string;
  userName: string;
  userEmail: string;
  answers: QuizAnswer[];
  questions: QuizQuestion[];
  submittedAt: string;
  reviewedAt: string | null;
};

export type MyResponse = {
  id: string;
  quizId: string;
  answers: QuizAnswer[];
  submittedAt: string;
};

export type HireProgressRow = {
  userId: string;
  name: string;
  email: string;
  daysDone: number;
  daysTotal: number;
  quizzesDone: number;
  quizzesTotal: number;
  lastQuizAt: string | null;
  quizTitles: string[];
};

function parseQuestions(raw: unknown): QuizQuestion[] {
  if (Array.isArray(raw)) return raw as QuizQuestion[];
  if (typeof raw !== "string") return [];
  try {
    const value = JSON.parse(raw) as QuizQuestion[];
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function parseAnswers(raw: unknown): QuizAnswer[] {
  if (Array.isArray(raw)) return raw as QuizAnswer[];
  if (typeof raw !== "string") return [];
  try {
    const value = JSON.parse(raw) as QuizAnswer[];
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function slugId(seed: string) {
  return seed.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
}

const ask = (prompt: string, type: QuestionType = "short", choices?: string[]): QuizQuestion => ({
  id: slugId(prompt),
  prompt,
  type,
  choices,
});

const DEFAULT_QUIZZES: Omit<Quiz, "sortOrder">[] = [
  {
    id: "day-01-checkin",
    title: "Day 1 check-in",
    lessonSlug: "day-01",
    intro: "Two takeaways and a quick product check. Your professor reads every answer here.",
    questions: [
      ask("What are your top two takeaways from today?"),
      ask("Where do you want more training or support?"),
      ask("How many arches are in the foot?", "choice", ["One", "Two", "Three"]),
      ask("Name the three supports in the 3-Step System."),
    ],
  },
  {
    id: "day-02-product",
    title: "Product & arch knowledge",
    lessonSlug: "day-02",
    intro: "Check that Day 1 landed before you greet a Client.",
    questions: [
      ask("What is the first thing you do when a Client walks in?"),
      ask("When do you pick up the tablet in the interview?"),
      ask("What does the Harris Mat show you?"),
      ask("What does the Brannock device measure?"),
    ],
  },
  {
    id: "day-04-walks",
    title: "Discovery and walks",
    lessonSlug: "day-04",
    intro: "Before you close, prove you can talk the walks.",
    questions: [
      ask("Where should the Client feel the Strengthener?"),
      ask("What is the 2nd WOW moment on the Strengthener walk?"),
      ask("Where should they feel the Maintainer?"),
      ask("Why do we reprint after the Strengthener walk?"),
    ],
  },
  {
    id: "day-09-product",
    title: "Product knowledge",
    lessonSlug: "day-09",
    intro: "Same ground as the old Google quizzes — one place, not two folders.",
    questions: [
      ask("In one sentence, why the Strengthener?"),
      ask("In one sentence, why the Maintainer?"),
      ask("In one sentence, why the Relaxer?"),
      ask("When would you recommend a 4th / lifestyle support?"),
    ],
  },
  {
    id: "day-13-ops",
    title: "Operations check",
    lessonSlug: "day-13",
    intro: "Name the gaps so the office can train them.",
    questions: [
      ask("List any operational items you still need to practice."),
      ask("How do you handle tablets Friday night vs. the rest of the week?"),
      ask("What goes in a note after a follow-up call?"),
    ],
  },
  {
    id: "day-10-week",
    title: "Week 2 wrap",
    lessonSlug: "day-10",
    intro: "Saturday recap for your professor.",
    questions: [
      ask("Top two takeaways from Week 2."),
      ask("What do you want to role-play next week?"),
    ],
  },
  {
    id: "day-15-week",
    title: "Week 3 wrap",
    lessonSlug: "day-15",
    intro: "Saturday recap for your professor.",
    questions: [
      ask("Top two takeaways from Week 3."),
      ask("What presentation gaps are still open?"),
    ],
  },
  {
    id: "day-20-final",
    title: "30-day close",
    lessonSlug: "day-20",
    intro: "Your last check-in. The office reads this instead of hunting a folder.",
    questions: [
      ask("What are you most confident doing on the floor now?"),
      ask("What do you still want coached?"),
      ask("One Client story from the month that taught you something."),
    ],
  },
];

async function ensureQuizTables() {
  const sql = await getSql();
  const seeded = await sql<{ value: string }>`
    select value from cms_settings where key = 'quizzes_v1' limit 1
  `;
  if (seeded.length) return;
  for (const [i, quiz] of DEFAULT_QUIZZES.entries()) {
    await sql`
      insert into quizzes (id, title, lesson_slug, intro, questions, sort_order)
      values (
        ${quiz.id}, ${quiz.title}, ${quiz.lessonSlug}, ${quiz.intro},
        ${JSON.stringify(quiz.questions)}, ${i}
      )
      on conflict (id) do nothing
    `;
  }
  await sql`
    insert into cms_settings (key, value) values ('quizzes_v1', '1')
    on conflict (key) do nothing
  `;
}

async function assertOffice(userId: string) {
  const role = await readAccessRole(userId);
  if (isLeader(role)) return;
  const { canManageTrainingId } = await import("@/lib/access");
  if (await canManageTrainingId(userId)) return;
  throw new Error("Forbidden");
}

async function loadQuizzes(): Promise<Quiz[]> {
  await ensureQuizTables();
  const sql = await getSql();
  const rows = await sql<{
    id: string;
    title: string;
    lesson_slug: string | null;
    intro: string | null;
    questions: string;
    sort_order: number;
  }>`
    select id, title, lesson_slug, intro, questions, sort_order
    from quizzes
    where archived = false
    order by sort_order asc, title asc
    limit 500
  `;
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    lessonSlug: row.lesson_slug ?? "",
    intro: row.intro ?? "",
    questions: parseQuestions(row.questions),
    sortOrder: Number(row.sort_order) || 0,
  }));
}

async function loadMyResponses(userId: string): Promise<MyResponse[]> {
  await ensureQuizTables();
  const sql = await getSql();
  const rows = await sql<{
    id: string;
    quiz_id: string;
    answers: string;
    submitted_at: unknown;
  }>`
    select id, quiz_id, answers, submitted_at
    from quiz_responses
    where user_id = ${userId}
    order by submitted_at desc
    limit 500
  `;
  return rows.map((row) => ({
    id: row.id,
    quizId: row.quiz_id,
    answers: parseAnswers(row.answers),
    submittedAt:
      row.submitted_at instanceof Date
        ? row.submitted_at.toISOString()
        : String(row.submitted_at ?? ""),
  }));
}

async function loadInbox(): Promise<QuizResponse[]> {
  await ensureQuizTables();
  const sql = await getSql();
  const rows = await sql<{
    id: string;
    quiz_id: string;
    quiz_title: string;
    lesson_slug: string | null;
    user_id: string;
    user_name: string;
    user_email: string;
    answers: string;
    questions: string;
    submitted_at: unknown;
    reviewed_at: unknown;
  }>`
    select
      r.id,
      r.quiz_id,
      q.title as quiz_title,
      q.lesson_slug,
      r.user_id,
      u.name as user_name,
      u.email as user_email,
      r.answers,
      q.questions,
      r.submitted_at,
      r.reviewed_at
    from quiz_responses r
    left join quizzes q on q.id = r.quiz_id
    left join "user" u on u.id = r.user_id
    order by r.submitted_at desc
    limit 1000
  `;
  return rows.map((row) => ({
    id: row.id,
    quizId: row.quiz_id,
    quizTitle: row.quiz_title ?? "Check-in",
    lessonSlug: row.lesson_slug ?? "",
    userId: row.user_id,
    userName: row.user_name || "Unknown",
    userEmail: row.user_email || "",
    answers: parseAnswers(row.answers).map((answer) => ({
      ...answer,
      prompt:
        answer.prompt ||
        parseQuestions(row.questions).find((q) => q.id === answer.questionId)?.prompt,
    })),
    questions: parseQuestions(row.questions),
    submittedAt:
      row.submitted_at instanceof Date
        ? row.submitted_at.toISOString()
        : String(row.submitted_at ?? ""),
    reviewedAt:
      row.reviewed_at == null
        ? null
        : row.reviewed_at instanceof Date
          ? row.reviewed_at.toISOString()
          : String(row.reviewed_at),
  }));
}

export const listQuizzes = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async () => loadQuizzes());

export const saveQuiz = createServerFn({ method: "POST" })
  .validator((input: Quiz) => {
    if (!input || typeof input.title !== "string" || !input.title.trim() || input.title.length > 180) {
      throw new Error("Quiz title is required and must be under 180 characters.");
    }
    if (typeof input.lessonSlug !== "string" || input.lessonSlug.length > 100) throw new Error("Lesson slug is invalid.");
    if (typeof input.intro !== "string" || input.intro.length > 2000) throw new Error("Quiz introduction is too long.");
    if (!Array.isArray(input.questions) || input.questions.length > 100) throw new Error("A quiz may contain at most 100 questions.");
    const ids = new Set<string>();
    for (const question of input.questions) {
      if (!question || typeof question.id !== "string" || !question.id || ids.has(question.id) ||
          typeof question.prompt !== "string" || !question.prompt.trim() || question.prompt.length > 1000 ||
          !["short", "long", "choice"].includes(question.type)) {
        throw new Error("Each question needs a unique id, prompt, and valid type.");
      }
      ids.add(question.id);
      if (question.choices && (!Array.isArray(question.choices) || question.choices.length > 30 ||
          question.choices.some((choice) => typeof choice !== "string" || choice.length > 300))) {
        throw new Error("Question choices are invalid.");
      }
    }
    return input;
  })
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    await assertOffice(context.userId);
    await ensureQuizTables();
    const id = data.id?.trim() || globalThis.crypto.randomUUID();
    const sql = await getSql();
    await sql`
      insert into quizzes (id, title, lesson_slug, intro, questions, sort_order, archived, updated_at)
      values (
        ${id},
        ${data.title.trim()},
        ${data.lessonSlug.trim() || null},
        ${data.intro.trim() || null},
        ${JSON.stringify(data.questions)},
        ${Number(data.sortOrder) || 0},
        false,
        now()
      )
      on conflict (id) do update set
        title = excluded.title,
        lesson_slug = excluded.lesson_slug,
        intro = excluded.intro,
        questions = excluded.questions,
        sort_order = excluded.sort_order,
        archived = false,
        updated_at = now()
    `;
    return loadQuizzes();
  });

export const deleteQuiz = createServerFn({ method: "POST" })
  .validator((id: string) => {
    if (typeof id !== "string" || !id.trim() || id.length > 100) throw new Error("Unknown quiz.");
    return id;
  })
  .middleware([authMiddleware])
  .handler(async ({ context, data: id }) => {
    await assertOffice(context.userId);
    const sql = await getSql();
    await sql`update quizzes set archived = true, updated_at = now() where id = ${id}`;
    return loadQuizzes();
  });

export const submitQuiz = createServerFn({ method: "POST" })
  .validator((input: { quizId: string; answers: QuizAnswer[] }) => {
    if (!input || typeof input.quizId !== "string" || !input.quizId.trim() || input.quizId.length > 100) {
      throw new Error("Unknown quiz.");
    }
    if (!Array.isArray(input.answers) || input.answers.length > 100 ||
        input.answers.some((answer) => !answer || typeof answer.questionId !== "string" ||
          typeof answer.value !== "string" || answer.value.length > 5000)) {
      throw new Error("Quiz answers are invalid.");
    }
    return input;
  })
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    await ensureQuizTables();
    const sql = await getSql();
    const quizzes = await sql<{ id: string }>`
      select id from quizzes where id = ${data.quizId} and archived = false limit 1
    `;
    if (!quizzes.length) throw new Error("That quiz is no longer available.");
    await sql`
      insert into quiz_responses (id, quiz_id, user_id, answers, submitted_at)
      values (
        ${globalThis.crypto.randomUUID()}, ${data.quizId}, ${context.userId},
        ${JSON.stringify(data.answers)}, now()
      )
      on conflict (quiz_id, user_id) do update set
        answers = excluded.answers, submitted_at = now(), reviewed_at = null
    `;
    return loadMyResponses(context.userId);
  });

export const myQuizResponses = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => loadMyResponses(context.userId));

export const listQuizInbox = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await assertOffice(context.userId);
    return loadInbox();
  });

export const markQuizReviewed = createServerFn({ method: "POST" })
  .validator((id: string) => {
    if (typeof id !== "string" || !id.trim() || id.length > 100) throw new Error("Unknown response.");
    return id;
  })
  .middleware([authMiddleware])
  .handler(async ({ context, data: id }) => {
    await assertOffice(context.userId);
    const sql = await getSql();
    await sql`update quiz_responses set reviewed_at = now() where id = ${id}`;
    return loadInbox();
  });

export const listHireProgress = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await assertOffice(context.userId);
    await ensureQuizTables();
    const sql = await getSql();
    const people = await sql<{
      id: string;
      name: string;
      email: string;
    }>`
      select u.id, u.name, u.email
      from "user" u
      left join user_profiles p on p.user_id = u.id
      where coalesce(p.access_role, 'pending') in ('new-hires', 'specialist', 'pending', 'mit')
      order by u.name asc
      limit 1000
    `;
    const progress = await sql<{ user_id: string; n: number }>`
      select lp.user_id, count(*)::int as n
      from lesson_progress lp
      join cms_lessons l
        on lp.lesson_key = 'onboarding/' || l.slug and l.track_id = 'onboarding'
      where lp.completed_at is not null
      group by lp.user_id
    `;
    const quizzes = await sql<{ user_id: string; n: number; last_at: unknown }>`
      select r.user_id, count(distinct r.quiz_id)::int as n, max(r.submitted_at) as last_at
      from quiz_responses r
      join quizzes q on q.id = r.quiz_id and q.archived = false
      group by r.user_id
    `;
    const titles = await sql<{ user_id: string; title: string }>`
      select r.user_id, q.title
      from quiz_responses r
      join quizzes q on q.id = r.quiz_id
      where q.archived = false
      order by q.sort_order asc
    `;
    const quizCount = await sql<{ n: number }>`
      select count(*)::int as n from quizzes where archived = false
    `;
    const dayCount = await sql<{ n: number }>`
      select count(*)::int as n from cms_lessons where track_id = 'onboarding'
    `;
    const doneMap = new Map(progress.map((r) => [r.user_id, Number(r.n)]));
    const quizMap = new Map(
      quizzes.map((r) => [
        r.user_id,
        {
          n: Number(r.n),
          last:
            r.last_at instanceof Date ? r.last_at.toISOString() : r.last_at ? String(r.last_at) : null,
        },
      ]),
    );
    const titleMap = new Map<string, string[]>();
    for (const row of titles) {
      const list = titleMap.get(row.user_id) ?? [];
      list.push(row.title);
      titleMap.set(row.user_id, list);
    }
    const quizzesTotal = Number(quizCount[0]?.n) || 0;
    return people.map(
      (p): HireProgressRow => ({
        userId: p.id,
        name: p.name,
        email: p.email,
        daysDone: doneMap.get(p.id) ?? 0,
        daysTotal: Number(dayCount[0]?.n) || 0,
        quizzesDone: quizMap.get(p.id)?.n ?? 0,
        quizzesTotal,
        lastQuizAt: quizMap.get(p.id)?.last ?? null,
        quizTitles: titleMap.get(p.id) ?? [],
      }),
    );
  });
