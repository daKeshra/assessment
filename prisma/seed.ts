import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { COMPETENCIES, LIKERT_LABELS } from "../src/lib/constants";

const db = new PrismaClient();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SeedOption = {
  text: string;
  correct?: boolean;
  score?: number;
  map?: Record<string, number>; // interest affinity per course code
};

type SeedQuestion = {
  type: string;
  prompt: string;
  stimulus?: string;
  svg?: string;
  difficulty?: 1 | 2 | 3;
  options?: SeedOption[];
  items?: string[]; // ORDERING: correct order
  comps: [string, number][]; // [competency code, weight]
  requiresManualScore?: boolean;
};

type SeedSection = {
  code: string;
  name: string;
  description: string;
  component: string;
  weight: number;
  questions: SeedQuestion[];
};

const likert = (): SeedOption[] =>
  LIKERT_LABELS.map((text, i) => ({ text, score: i + 1 }));

// ---------------------------------------------------------------------------
// Settings (PRD §43: thresholds, weights and timer are configuration)
// ---------------------------------------------------------------------------

const SETTINGS: {
  key: string;
  value: string;
  group: string;
  label: string;
  type: string;
  options?: string;
}[] = [
  { key: "min_recommend_score", value: "65", group: "thresholds", label: "Minimum recommendation score", type: "number" },
  { key: "multi_path_range", value: "5", group: "thresholds", label: "Multi-path range (points between top 3)", type: "number" },
  { key: "secondary_range", value: "5", group: "thresholds", label: "Secondary pathway range", type: "number" },
  { key: "confidence_high_top", value: "80", group: "thresholds", label: "Confidence HIGH: top score ≥", type: "number" },
  { key: "confidence_high_gap", value: "7", group: "thresholds", label: "Confidence HIGH: top-second gap ≥", type: "number" },
  { key: "confidence_high_practical", value: "70", group: "thresholds", label: "Confidence HIGH: practical score ≥", type: "number" },
  { key: "confidence_moderate_gap", value: "3", group: "thresholds", label: "Confidence MODERATE: gap ≥", type: "number" },
  { key: "min_completeness_high", value: "0.9", group: "thresholds", label: "Completeness required for HIGH confidence", type: "number" },
  { key: "min_completeness_moderate", value: "0.8", group: "thresholds", label: "Completeness required for MODERATE confidence", type: "number" },
  { key: "w_cognitive", value: "40", group: "scoring", label: "Cognitive aptitude weight (%)", type: "number" },
  { key: "w_simulation", value: "30", group: "scoring", label: "Practical simulation weight (%)", type: "number" },
  { key: "w_behaviour", value: "15", group: "scoring", label: "Behaviour weight (%)", type: "number" },
  { key: "w_interest", value: "10", group: "scoring", label: "Interest weight (%)", type: "number" },
  { key: "w_motivation", value: "5", group: "scoring", label: "Motivation weight (%)", type: "number" },
  { key: "timer_mode", value: "OVERALL", group: "assessment", label: "Timer mode", type: "select", options: "OVERALL,SECTION,NONE" },
  { key: "duration_minutes", value: "60", group: "assessment", label: "Duration (minutes)", type: "number" },
  { key: "allow_back", value: "true", group: "assessment", label: "Allow going back to previous questions", type: "boolean" },
  { key: "randomize_questions", value: "true", group: "anti-cheat", label: "Randomise question order", type: "boolean" },
  { key: "randomize_options", value: "true", group: "anti-cheat", label: "Randomise answer order", type: "boolean" },
  { key: "rapid_completion_pct", value: "0.25", group: "anti-cheat", label: "Flag completion faster than this fraction of allowed time", type: "number" },
  { key: "inactivity_minutes", value: "20", group: "anti-cheat", label: "Flag inactivity longer than (minutes)", type: "number" },
];

async function seedSettings() {
  for (const s of SETTINGS) {
    await db.setting.upsert({
      where: { key: s.key },
      update: {},
      create: s,
    });
  }
  console.log(`settings: ${SETTINGS.length} ensured`);
}

// ---------------------------------------------------------------------------
// Courses (PRD §18, §19) - competency weights 0..5, all editable in admin
// ---------------------------------------------------------------------------

const COURSES: {
  code: string;
  name: string;
  description: string;
  family: string;
  cta: string;
  progression: string[];
  weights: Record<string, number>;
}[] = [
  {
    code: "frontend_development",
    name: "Frontend Development",
    description: "Build the parts of websites and applications that people see and interact with.",
    family: "Technology Systems & Engineering",
    cta: "/courses/frontend-development",
    progression: ["Digital Foundations", "HTML/CSS", "JavaScript Fundamentals", "Responsive Interfaces", "APIs & State", "Portfolio Project"],
    weights: { LR: 3, PR: 4, AD: 5, PS: 4, ST: 3, PT: 3, VR: 4, CR: 4, EM: 3, CM: 3, AB: 3, PE: 4, EX: 3 },
  },
  {
    code: "backend_development",
    name: "Backend Development",
    description: "Build the server-side systems, databases and APIs that power digital products.",
    family: "Technology Systems & Engineering",
    cta: "/courses/backend-development",
    progression: ["Digital Foundations", "HTML/CSS + JavaScript", "Programming Fundamentals", "Backend Development", "Databases / APIs", "Portfolio Project"],
    weights: { LR: 5, ST: 5, PS: 5, AD: 5, AB: 5, PR: 4, PT: 4, PE: 5 },
  },
  {
    code: "mobile_development",
    name: "Mobile Development",
    description: "Design and build applications that run on phones and tablets.",
    family: "Technology Systems & Engineering",
    cta: "/courses/mobile-development",
    progression: ["Digital Foundations", "Programming Fundamentals", "UI Basics for Mobile", "Mobile App Development", "Device Features & Storage", "Portfolio App"],
    weights: { LR: 4, PR: 4, AD: 4, PS: 4, ST: 3, PT: 3, VR: 3, CR: 3, EM: 3, PE: 4, EX: 3, AB: 3 },
  },
  {
    code: "data_analysis",
    name: "Data Analysis",
    description: "Turn messy real-world data into clear answers and decisions.",
    family: "Data & Intelligence",
    cta: "/courses/data-analysis",
    progression: ["Digital Foundations", "Spreadsheets & Data Hygiene", "Descriptive Statistics", "Analysis Tools", "Dashboards & Reporting", "Portfolio Project"],
    weights: { NR: 5, PR: 5, AD: 5, LR: 4, PS: 4, IN: 4 },
  },
  {
    code: "data_science",
    name: "Data Science",
    description: "Use data to model, predict and explain real-world outcomes.",
    family: "Data & Intelligence",
    cta: "/courses/data-science",
    progression: ["Digital Foundations", "Programming Fundamentals", "Statistics for Data", "Data Wrangling", "Modelling & Prediction", "Portfolio Project"],
    weights: { NR: 5, PR: 5, AB: 4, LR: 4, PS: 4, IN: 4, CR: 2, ST: 3, PE: 4, EX: 4 },
  },
  {
    code: "cybersecurity",
    name: "Cybersecurity",
    description: "Protect systems, networks and people from digital threats.",
    family: "Security & Assurance",
    cta: "/courses/cybersecurity",
    progression: ["Digital Foundations", "Networking Basics", "Threat Awareness", "Defensive Security", "Investigation & Response", "Portfolio Project"],
    weights: { IN: 5, AD: 5, LR: 5, ST: 4, PS: 4, PT: 4, AB: 3, PE: 5, DM: 4, PR: 4 },
  },
  {
    code: "ai_workflow_automation",
    name: "AI Workflow Automation",
    description: "Design systems that perform repetitive work automatically, with AI where it helps.",
    family: "Data & Intelligence",
    cta: "/courses/ai-workflow-automation",
    progression: ["Digital Foundations", "Process Mapping", "Automation Fundamentals", "AI-Assisted Workflows", "Integrations & Error Handling", "Portfolio Project"],
    weights: { ST: 5, PT: 5, PS: 5, LR: 4, AD: 4, EX: 4, PR: 3, DM: 4, PE: 3, AB: 3 },
  },
  {
    code: "product_management",
    name: "Product Management",
    description: "Decide what to build, why it matters, and in what order.",
    family: "Product & Strategy",
    cta: "/courses/product-management",
    progression: ["Digital Foundations", "User & Market Research", "Prioritisation Frameworks", "Roadmapping", "Delivery & Stakeholders", "Portfolio Project"],
    weights: { DM: 5, CM: 5, EM: 5, ST: 4, PT: 4, PS: 4, LR: 3, PE: 4, IN: 3, AD: 3 },
  },
  {
    code: "digital_marketing",
    name: "Digital Marketing",
    description: "Grow reach, leads and sales using online channels and measurement.",
    family: "Growth & Communication",
    cta: "/courses/digital-marketing",
    progression: ["Digital Foundations", "Audience & Positioning", "Content & Channels", "Campaign Setup", "Measurement & Optimisation", "Portfolio Project"],
    weights: { CM: 4, EM: 4, DM: 4, PR: 4, NR: 3, AD: 3, PS: 3, PE: 3, EX: 3, ST: 3 },
  },
  {
    code: "blockchain_development",
    name: "Blockchain Development",
    description: "Build decentralised systems, smart contracts and on-chain applications.",
    family: "Technology Systems & Engineering",
    cta: "/courses/blockchain-development",
    progression: ["Digital Foundations", "Programming Fundamentals", "How Ledgers Work", "Smart Contracts", "Decentralised Apps", "Portfolio Project"],
    weights: { LR: 5, AB: 5, ST: 5, AD: 4, PS: 4, PT: 4, PE: 5, IN: 3 },
  },
  {
    code: "ui_ux_design",
    name: "UI/UX Design",
    description: "Design interfaces that are clear, usable and pleasant for real people.",
    family: "Creative & Experience",
    cta: "/courses/ui-ux-design",
    progression: ["Digital Foundations", "Visual Principles", "User Research", "Wireframes & Prototypes", "Usability Testing", "Portfolio Project"],
    weights: { VR: 5, CR: 5, EM: 5, AD: 5, PS: 4, CM: 4 },
  },
  {
    code: "social_media_marketing",
    name: "Social Media Marketing",
    description: "Build audiences and communities through social platforms and content.",
    family: "Growth & Communication",
    cta: "/courses/social-media-marketing",
    progression: ["Digital Foundations", "Platform Strategy", "Content Creation", "Community & Engagement", "Analytics & Paid Social", "Portfolio Project"],
    weights: { CM: 5, EM: 5, DM: 5, CR: 4, PR: 3, AD: 3, PE: 3, EX: 3 },
  },
  {
    code: "product_design",
    name: "Product Design",
    description: "Shape the overall look, feel and experience of a digital product end to end.",
    family: "Creative & Experience",
    cta: "/courses/product-design",
    progression: ["Digital Foundations", "Design Principles", "Interaction Design", "Visual Systems", "Design Handoff", "Portfolio Project"],
    weights: { VR: 5, CR: 5, EM: 5, AD: 4, CM: 4, PS: 4, DM: 4, PT: 3 },
  },
];

async function seedCompetencies() {
  for (const c of COMPETENCIES) {
    await db.competency.upsert({
      where: { code: c.code },
      update: { name: c.name, description: c.description },
      create: { code: c.code, name: c.name, description: c.description },
    });
  }
  console.log(`competencies: ${COMPETENCIES.length} ensured`);
}

async function seedCourses() {
  const comps = await db.competency.findMany();
  const idByCode = Object.fromEntries(comps.map((c) => [c.code, c.id]));

  for (const [index, c] of COURSES.entries()) {
    const course = await db.course.upsert({
      where: { courseCode: c.code },
      update: {
        courseName: c.name,
        description: c.description,
        careerFamily: c.family,
        ctaUrl: c.cta,
        progressionJson: JSON.stringify(c.progression),
        displayOrder: index + 1,
      },
      create: {
        courseCode: c.code,
        courseName: c.name,
        description: c.description,
        careerFamily: c.family,
        ctaUrl: c.cta,
        progressionJson: JSON.stringify(c.progression),
        minimumScore: 65,
        displayOrder: index + 1,
      },
    });

    for (const [code, weight] of Object.entries(c.weights)) {
      const competencyId = idByCode[code];
      if (!competencyId) continue;
      await db.courseCompetencyWeight.upsert({
        where: { courseId_competencyId: { courseId: course.id, competencyId } },
        update: { weight },
        create: { courseId: course.id, competencyId, weight },
      });
    }
  }
  console.log(`courses: ${COURSES.length} ensured with competency weights`);
}

async function seedUsers() {
  const users = [
    { email: "admin@africinnovate.com", name: "Africinnovate Administrator", role: "ADMIN", password: "Admin123!" },
    { email: "admissions@africinnovate.com", name: "Admissions Desk", role: "ADMISSIONS", password: "Admissions123!" },
    { email: "instructor@africinnovate.com", name: "Course Instructor", role: "INSTRUCTOR", password: "Instructor123!" },
  ];
  for (const u of users) {
    const passwordHash = await bcrypt.hash(u.password, 10);
    await db.user.upsert({
      where: { email: u.email },
      update: { role: u.role },
      create: { email: u.email, name: u.name, role: u.role, passwordHash },
    });
  }
  console.log(`users: ${users.length} ensured`);
}

export { seedSettings, seedCompetencies, seedCourses, seedUsers, db };
export type { SeedQuestion, SeedSection, SeedOption };

// ---------------------------------------------------------------------------
// Assessment content - Version 1.0 (65 questions, PRD sections 9-17)
// ---------------------------------------------------------------------------

const SECTIONS: SeedSection[] = [
  // ---------------- SECTION A: Logical & Abstract Reasoning ----------------
  {
    code: "A",
    name: "Logical & Abstract Reasoning",
    description: "Identify rules, deduce relationships and sequence information.",
    component: "COGNITIVE",
    weight: 15,
    questions: [
      {
        type: "MULTIPLE_CHOICE",
        prompt: "Which number comes next?  2, 6, 12, 20, 30, ?",
        difficulty: 2,
        comps: [["LR", 2], ["PR", 1]],
        options: [
          { text: "36" }, { text: "40" }, { text: "42", correct: true }, { text: "44" }, { text: "48" },
        ],
      },
      {
        type: "MULTIPLE_CHOICE",
        prompt: "Every Koro is a Luma. Some Lumas are red. Which statement must be true?",
        difficulty: 2,
        comps: [["LR", 2], ["AB", 1]],
        options: [
          { text: "Some Koros are red" },
          { text: "Every Luma is a Koro" },
          { text: "Some Koros are Lumas", correct: true },
          { text: "No Koro is ever red" },
        ],
      },
      {
        type: "MULTIPLE_CHOICE",
        prompt: "Which letter comes next?  A, C, F, J, ?",
        difficulty: 1,
        comps: [["PR", 2], ["LR", 1]],
        options: [{ text: "H" }, { text: "K" }, { text: "M" }, { text: "O", correct: true }, { text: "Q" }],
      },
      {
        type: "MULTIPLE_CHOICE",
        prompt: "Which number comes next?  3, 9, 4, 16, 5, ?",
        difficulty: 2,
        comps: [["PR", 2], ["AB", 1]],
        options: [{ text: "20" }, { text: "21" }, { text: "25", correct: true }, { text: "30" }, { text: "36" }],
      },
      {
        type: "MULTIPLE_CHOICE",
        prompt:
          "If it rains tomorrow, the outdoor class is moved indoors. The outdoor class was not moved indoors. What can you conclude?",
        difficulty: 2,
        comps: [["LR", 2], ["DM", 1]],
        options: [
          { text: "It rained tomorrow" },
          { text: "It did not rain tomorrow", correct: true },
          { text: "The class was cancelled" },
          { text: "Nothing can be concluded from this rule" },
        ],
      },
      {
        type: "MULTIPLE_CHOICE",
        prompt: "Book is to Reading as Fork is to...?",
        difficulty: 1,
        comps: [["LR", 1], ["AB", 1]],
        options: [
          { text: "Writing" }, { text: "Eating", correct: true }, { text: "Cooking" }, { text: "Cutting" },
        ],
      },
      {
        type: "MULTIPLE_CHOICE",
        prompt: "In a simple code, CAT is written as DBU. Using exactly the same rule, DOG is written as:",
        difficulty: 2,
        comps: [["AB", 2], ["PR", 1]],
        options: [{ text: "EPH", correct: true }, { text: "EPJ" }, { text: "DPH" }, { text: "FQI" }],
      },
      {
        type: "MULTIPLE_CHOICE",
        prompt: "Which number does not belong?  2, 3, 5, 9, 11",
        difficulty: 1,
        comps: [["LR", 1], ["AD", 1]],
        options: [{ text: "2" }, { text: "3" }, { text: "5" }, { text: "9", correct: true }, { text: "11" }],
      },
      {
        type: "MULTIPLE_CHOICE",
        prompt:
          "Each row follows the same rule:  2, 4, 8   |   3, 9, 27   |   5, 25, ?  Which number completes the last row?",
        difficulty: 3,
        comps: [["PR", 2], ["AB", 1]],
        options: [{ text: "50" }, { text: "75" }, { text: "100" }, { text: "125", correct: true }, { text: "150" }],
      },
      {
        type: "MULTIPLE_CHOICE",
        prompt:
          "In a group of students, 60% pass Mathematics, 50% pass English, and exactly 20% fail both. What percentage pass both?",
        difficulty: 3,
        comps: [["LR", 2], ["PS", 1], ["NR", 1]],
        options: [{ text: "10%" }, { text: "20%" }, { text: "30%", correct: true }, { text: "40%" }, { text: "50%" }],
      },
    ],
  },

  // ---------------- SECTION B: Numerical & Data Reasoning ----------------
  {
    code: "B",
    name: "Numerical & Data Reasoning",
    description: "Percentages, ratios, averages, tables and safe conclusions from data.",
    component: "COGNITIVE",
    weight: 12,
    questions: [
      {
        type: "MULTIPLE_CHOICE",
        stimulus:
          "Students who attended more than 80% of classes generally scored higher than students who attended less than 50%.",
        prompt: "Which conclusion is safest based on this statement?",
        difficulty: 1,
        comps: [["NR", 1], ["ST", 2], ["PS", 1]],
        options: [
          { text: "Attendance definitely causes higher scores" },
          { text: "Attendance and performance appear to be associated", correct: true },
          { text: "Low-attendance students cannot succeed" },
          { text: "Attendance has no relationship with performance" },
        ],
      },
      {
        type: "MULTIPLE_CHOICE",
        prompt: "A professional training course costs ₦45,000. A 12% discount is applied. What is the new price?",
        difficulty: 1,
        comps: [["NR", 2], ["PS", 1]],
        options: [
          { text: "₦36,000" },
          { text: "₦39,600", correct: true },
          { text: "₦40,500" },
          { text: "₦41,400" },
        ],
      },
      {
        type: "MULTIPLE_CHOICE",
        prompt:
          "In a class, the ratio of day students to evening students is 3:5. If there are 48 students in total, how many are day students?",
        difficulty: 2,
        comps: [["NR", 2]],
        options: [{ text: "18", correct: true }, { text: "20" }, { text: "30" }, { text: "33" }],
      },
      {
        type: "MULTIPLE_CHOICE",
        prompt: "A learner scores 55, 62, 70, 75 and 68 in five tests. What is the average score?",
        difficulty: 1,
        comps: [["NR", 1], ["AD", 1]],
        options: [{ text: "64" }, { text: "66", correct: true }, { text: "68" }, { text: "70" }],
      },
      {
        type: "MULTIPLE_SELECT",
        stimulus: "Week | Orders\nW1 | 120\nW2 | 140\nW3 | 110\nW4 | 160",
        prompt: "Which statements are supported by this data? Select all that apply.",
        difficulty: 2,
        comps: [["NR", 2], ["ST", 1]],
        options: [
          { text: "Orders were higher in Week 4 than in Week 1", correct: true },
          { text: "Orders were lower in Week 3 than in Week 2", correct: true },
          { text: "Orders increased every single week" },
          { text: "Week 3 had the highest number of orders" },
        ],
      },
      {
        type: "MULTIPLE_CHOICE",
        prompt:
          "A customer list has 300 rows, including 40 duplicates and 15 blank email addresses. What should happen before analysis begins?",
        difficulty: 2,
        comps: [["AD", 2], ["PS", 1], ["NR", 1]],
        options: [
          { text: "Confirm and clean the duplicates and missing values first", correct: true },
          { text: "Delete the entire list and start over" },
          { text: "Fill every gap with random values" },
          { text: "Ignore the issues and begin the analysis" },
        ],
      },
      {
        type: "MULTIPLE_CHOICE",
        prompt: "A website's daily visits rose from 200 to 260. What was the percentage increase?",
        difficulty: 1,
        comps: [["NR", 2]],
        options: [{ text: "20%" }, { text: "26%" }, { text: "30%", correct: true }, { text: "60%" }],
      },
      {
        type: "MULTIPLE_CHOICE",
        prompt:
          "Shops that play background music are observed to sell more snacks than shops that do not. What is the safest conclusion?",
        difficulty: 2,
        comps: [["ST", 2], ["NR", 1], ["DM", 1]],
        options: [
          { text: "Music definitely causes higher sales" },
          {
            text: "Music and sales appear to be associated; an experiment would be needed to prove cause",
            correct: true,
          },
          { text: "Music has no effect on sales" },
          { text: "All shops should stop playing music" },
        ],
      },
    ],
  },

  // ---------------- SECTION C: Pattern & Attention to Detail ----------------
  {
    code: "C",
    name: "Pattern & Attention to Detail",
    description: "Symbol matching, sequence identification, error detection and inconsistencies.",
    component: "COGNITIVE",
    weight: 12,
    questions: [
      {
        type: "MULTIPLE_CHOICE",
        prompt: "Which symbol comes next?   ▲  ●  ▲▲  ●  ▲▲▲  ●  ?",
        difficulty: 1,
        comps: [["PR", 2], ["AD", 1]],
        options: [{ text: "▲", correct: true }, { text: "●" }, { text: "▼" }, { text: "■" }],
      },
      {
        type: "MULTIPLE_CHOICE",
        stimulus: "Target: AFRICINNOVATE-2024/AD",
        prompt: "Which line is an exact match to the target above?",
        difficulty: 1,
        comps: [["AD", 2]],
        options: [
          { text: "AFRICINNOVATE-2024/AD", correct: true },
          { text: "AFRICINNOVATE_2024/AD" },
          { text: "AFRICINNOVATE-2024/DA" },
          { text: "AFRICINNOVATE-2024/AD-" },
        ],
      },
      {
        type: "MULTIPLE_CHOICE",
        prompt:
          "A list should start at 7 and add 3 each time: 7, 10, 13, 17, 20. Which number breaks the rule?",
        difficulty: 2,
        comps: [["AD", 2], ["PR", 1]],
        options: [{ text: "7" }, { text: "10" }, { text: "17", correct: true }, { text: "20" }],
      },
      {
        type: "MULTIPLE_CHOICE",
        stimulus: "Amaka - 08031234567\nTunde - 08031234568\nKelechi - 07012345678\nBola - 12345",
        prompt: "Every entry should be an 11-digit phone number. Which entry breaks the rule?",
        difficulty: 2,
        comps: [["AD", 2]],
        options: [
          { text: "Amaka - 08031234567" },
          { text: "Tunde - 08031234568" },
          { text: "Kelechi - 07012345678" },
          { text: "Bola - 12345", correct: true },
        ],
      },
      {
        type: "MULTIPLE_CHOICE",
        stimulus: "Receive three free entries every evening.",
        prompt: 'How many times does the letter "e" appear in the sentence above?',
        difficulty: 3,
        comps: [["AD", 3]],
        options: [{ text: "11" }, { text: "12" }, { text: "13", correct: true }, { text: "14" }],
      },
      {
        type: "MULTIPLE_CHOICE",
        stimulus: "Invoice numbers: JMT-4471, JMT-4471, JMT-4417, JMT-4471",
        prompt: "Which invoice number is the outlier?",
        difficulty: 2,
        comps: [["AD", 2], ["PR", 1]],
        options: [
          { text: "JMT-4417", correct: true },
          { text: "JMT-4471 (first)" },
          { text: "JMT-4471 (second)" },
          { text: "JMT-4471 (fourth)" },
        ],
      },
      {
        type: "MULTIPLE_CHOICE",
        prompt:
          "Study the rule: result = first digit x second digit - 1. Which value is wrong?   35 -> 14,  46 -> 23,  27 -> 12,  58 -> 39",
        difficulty: 3,
        comps: [["AD", 2], ["LR", 2]],
        options: [
          { text: "35 -> 14" },
          { text: "46 -> 23" },
          { text: "27 -> 12", correct: true },
          { text: "58 -> 39" },
        ],
      },
      {
        type: "MULTIPLE_CHOICE",
        prompt: "Which number does not belong?   6, 12, 24, 48, 50, 96",
        difficulty: 3,
        comps: [["PR", 2], ["AD", 2]],
        options: [{ text: "6" }, { text: "12" }, { text: "48" }, { text: "50", correct: true }, { text: "96" }],
      },
    ],
  },

  // ---------------- SECTION D: Systems & Process Thinking ----------------
  {
    code: "D",
    name: "Systems & Process Thinking",
    description: "Missing steps, bottlenecks, dependencies, ordering and automation opportunities.",
    component: "COGNITIVE",
    weight: 13,
    questions: [
      {
        type: "MULTIPLE_CHOICE",
        stimulus:
          "Student registers\n       |\nPayment verified\n       |\nConfirmation sent\n       |\nStudent record created\n       |\nTraining details sent",
        prompt: "Which step is most likely missing from this process?",
        difficulty: 2,
        comps: [["ST", 2], ["PT", 2]],
        options: [
          { text: "A path for what happens when payment is not verified", correct: true },
          { text: "Sending the training details a second time" },
          { text: "Printing the confirmation for the file" },
          { text: "Deleting old student records" },
        ],
      },
      {
        type: "MULTIPLE_CHOICE",
        stimulus:
          "Confirmation emails sometimes arrive 6 hours late because a staff member sends them manually between 9am and 5pm.",
        prompt: "Where is the bottleneck in this process?",
        difficulty: 2,
        comps: [["PT", 2], ["ST", 1], ["PS", 1]],
        options: [
          { text: "The manual confirmation step", correct: true },
          { text: "The number of students registering" },
          { text: "The training details email" },
          { text: "The registration form itself" },
        ],
      },
      {
        type: "ORDERING",
        prompt: "Arrange these steps of ordering a product online in the correct order:",
        difficulty: 2,
        comps: [["PT", 2], ["ST", 1]],
        items: [
          "Customer adds product to cart",
          "Customer enters delivery address",
          "Payment is taken",
          "Order confirmation is sent",
          "Product is dispatched",
        ],
      },
      {
        type: "MULTIPLE_CHOICE",
        prompt:
          "A monthly report cannot be produced until the sales data has been exported and checked. What does this tell you?",
        difficulty: 1,
        comps: [["PT", 2], ["ST", 1]],
        options: [
          { text: "Exporting and checking must happen before the report", correct: true },
          { text: "The report and the export can happen in any order" },
          { text: "The report causes the data to be checked" },
          { text: "Checking the data is optional" },
        ],
      },
      {
        type: "MULTIPLE_CHOICE",
        prompt:
          "Every morning, a staff member copies order details from emails into a spreadsheet. What is the best improvement?",
        difficulty: 2,
        comps: [["ST", 2], ["PS", 2], ["PT", 1]],
        options: [
          { text: "Have the order form submit straight into the system automatically", correct: true },
          { text: "Hire more staff so the copying happens faster" },
          { text: "Send more emails so nothing is missed" },
          { text: "Copy each row twice for accuracy" },
        ],
      },
      {
        type: "MULTIPLE_CHOICE",
        prompt:
          "In an enrolment process, when a payment fails the candidate never hears anything. Which addition makes the process most reliable?",
        difficulty: 2,
        comps: [["ST", 2], ["DM", 2]],
        options: [
          { text: "A failure notification with next steps and a retry option", correct: true },
          { text: "A longer registration form" },
          { text: "Removing the payment step entirely" },
          { text: "Waiting to see if the candidate complains" },
        ],
      },
      {
        type: "MULTIPLE_CHOICE",
        stimulus:
          "Enrolment workflow steps: verify payment, create student record, assign instructor, send welcome email, prepare ID badge.",
        prompt: "Which pair of steps can safely happen at the same time (in parallel)?",
        difficulty: 3,
        comps: [["PT", 2], ["ST", 1]],
        options: [
          { text: "Send welcome email and prepare ID badge", correct: true },
          { text: "Verify payment and create student record" },
          { text: "Create student record and delete student record" },
          { text: "Export the data and immediately delete the export" },
        ],
      },
      {
        type: "MULTIPLE_CHOICE",
        prompt:
          "The company's SMS provider goes down while candidates are being notified by text. Which response keeps the process working best?",
        difficulty: 3,
        comps: [["ST", 2], ["DM", 1], ["PS", 1]],
        options: [
          { text: "Queue the messages and fall back to email until the provider recovers", correct: true },
          { text: "Stop the entire enrolment process until it is fixed" },
          { text: "Manually retype messages into the same broken provider" },
          { text: "Ignore the failure; candidates will find out eventually" },
        ],
      },
    ],
  },
  // ---------------- SECTION E: Visual & Design Reasoning ----------------
  {
    code: "E",
    name: "Visual & Design Reasoning",
    description: "Visual hierarchy, layout, spacing, usability and user perspective.",
    component: "COGNITIVE",
    weight: 10,
    questions: [
      {
        type: "VISUAL",
        prompt: "Which interface makes the primary action easier to identify?",
        difficulty: 2,
        comps: [["VR", 2], ["EM", 1]],
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 300">
  <rect width="720" height="300" fill="#ffffff"/>
  <rect x="8" y="8" width="344" height="284" fill="#f8fafc" stroke="#cbd5e1"/>
  <rect x="368" y="8" width="344" height="284" fill="#f8fafc" stroke="#cbd5e1"/>
  <text x="26" y="36" font-family="sans-serif" font-size="15" fill="#0f172a">Option A</text>
  <text x="386" y="36" font-family="sans-serif" font-size="15" fill="#0f172a">Option B</text>
  <rect x="30" y="56" width="300" height="40" fill="#e2e8f0" stroke="#94a3b8"/>
  <text x="46" y="81" font-family="sans-serif" font-size="13" fill="#334155">Submit application</text>
  <rect x="30" y="108" width="300" height="40" fill="#e2e8f0" stroke="#94a3b8"/>
  <text x="46" y="133" font-family="sans-serif" font-size="13" fill="#334155">Preview</text>
  <rect x="30" y="160" width="300" height="40" fill="#e2e8f0" stroke="#94a3b8"/>
  <text x="46" y="185" font-family="sans-serif" font-size="13" fill="#334155">Share</text>
  <rect x="30" y="212" width="300" height="40" fill="#e2e8f0" stroke="#94a3b8"/>
  <text x="46" y="237" font-family="sans-serif" font-size="13" fill="#334155">Save draft</text>
  <rect x="390" y="56" width="300" height="36" fill="#e2e8f0" stroke="#94a3b8"/>
  <text x="406" y="79" font-family="sans-serif" font-size="13" fill="#334155">Save draft</text>
  <rect x="390" y="104" width="300" height="36" fill="#e2e8f0" stroke="#94a3b8"/>
  <text x="406" y="127" font-family="sans-serif" font-size="13" fill="#334155">Preview</text>
  <rect x="390" y="152" width="300" height="36" fill="#e2e8f0" stroke="#94a3b8"/>
  <text x="406" y="175" font-family="sans-serif" font-size="13" fill="#334155">Share</text>
  <rect x="390" y="212" width="300" height="52" fill="#4f46e5"/>
  <text x="406" y="244" font-family="sans-serif" font-size="16" font-weight="bold" fill="#ffffff">Submit application</text>
</svg>`,
        options: [
          { text: "Option A" },
          { text: "Option B", correct: true },
          { text: "Both are equally clear" },
          { text: "Neither - only colours matter here" },
        ],
      },
      {
        type: "VISUAL",
        prompt: "Which course card is easier to scan quickly?",
        difficulty: 2,
        comps: [["VR", 2], ["AD", 1]],
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 300">
  <rect width="720" height="300" fill="#ffffff"/>
  <rect x="8" y="8" width="344" height="284" fill="#f8fafc" stroke="#cbd5e1"/>
  <rect x="368" y="8" width="344" height="284" fill="#f8fafc" stroke="#cbd5e1"/>
  <text x="26" y="36" font-family="sans-serif" font-size="15" fill="#0f172a">Option A</text>
  <text x="386" y="36" font-family="sans-serif" font-size="15" fill="#0f172a">Option B</text>
  <rect x="30" y="56" width="300" height="220" fill="#ffffff" stroke="#cbd5e1"/>
  <text x="46" y="86" font-family="sans-serif" font-size="16" font-weight="bold" fill="#0f172a">Data Analysis</text>
  <rect x="46" y="100" width="60" height="16" fill="#e0e7ff"/>
  <text x="46" y="140" font-family="sans-serif" font-size="12" fill="#475569">12 weeks - Beginner friendly</text>
  <text x="46" y="164" font-family="sans-serif" font-size="12" fill="#475569">Learn to clean, explore and</text>
  <text x="46" y="182" font-family="sans-serif" font-size="12" fill="#475569">present data with confidence.</text>
  <rect x="46" y="220" width="140" height="36" fill="#4f46e5"/>
  <text x="60" y="243" font-family="sans-serif" font-size="13" fill="#ffffff">View course</text>
  <rect x="390" y="52" width="300" height="232" fill="#ffffff" stroke="#cbd5e1"/>
  <text x="400" y="72" font-family="sans-serif" font-size="15" font-weight="bold" fill="#0f172a">Data Analysis</text>
  <text x="400" y="88" font-family="sans-serif" font-size="11" fill="#475569">12 weeks - Beginner friendly</text>
  <text x="400" y="104" font-family="sans-serif" font-size="11" fill="#475569">Learn to clean, explore and present</text>
  <text x="400" y="122" font-family="sans-serif" font-size="11" fill="#475569">data with confidence. Includes live</text>
  <text x="400" y="134" font-family="sans-serif" font-size="11" fill="#475569">mentoring and weekly projects.</text>
  <rect x="400" y="142" width="90" height="26" fill="#e2e8f0"/>
  <text x="410" y="159" font-family="sans-serif" font-size="11" fill="#334155">Beginner</text>
  <rect x="400" y="176" width="280" height="34" fill="#4f46e5"/>
  <text x="412" y="198" font-family="sans-serif" font-size="13" fill="#ffffff">View course</text>
  <text x="400" y="230" font-family="sans-serif" font-size="11" fill="#94a3b8">Fee: N120,000 - Instalments available - Starts 3 March - Location: Online</text>
</svg>`,
        options: [
          { text: "Option A", correct: true },
          { text: "Option B" },
          { text: "Both are equally easy to scan" },
          { text: "Neither - only colour matters" },
        ],
      },
      {
        type: "VISUAL",
        prompt: "Which layout makes the document structure clearest?",
        difficulty: 2,
        comps: [["VR", 2], ["AD", 1]],
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 300">
  <rect width="720" height="300" fill="#ffffff"/>
  <rect x="8" y="8" width="344" height="284" fill="#f8fafc" stroke="#cbd5e1"/>
  <rect x="368" y="8" width="344" height="284" fill="#f8fafc" stroke="#cbd5e1"/>
  <text x="26" y="36" font-family="sans-serif" font-size="15" fill="#0f172a">Option A</text>
  <text x="386" y="36" font-family="sans-serif" font-size="15" fill="#0f172a">Option B</text>
  <text x="30" y="70" font-family="sans-serif" font-size="20" font-weight="bold" fill="#0f172a">Course Guide</text>
  <rect x="30" y="82" width="290" height="6" fill="#cbd5e1"/>
  <text x="30" y="118" font-family="sans-serif" font-size="20" font-weight="bold" fill="#0f172a">Week 1 Overview</text>
  <rect x="30" y="128" width="270" height="5" fill="#e2e8f0"/>
  <rect x="30" y="140" width="240" height="5" fill="#e2e8f0"/>
  <text x="30" y="180" font-family="sans-serif" font-size="20" font-weight="bold" fill="#0f172a">Assessment</text>
  <rect x="30" y="190" width="280" height="5" fill="#e2e8f0"/>
  <rect x="30" y="202" width="220" height="5" fill="#e2e8f0"/>
  <text x="30" y="242" font-family="sans-serif" font-size="20" font-weight="bold" fill="#0f172a">Resources</text>
  <rect x="30" y="252" width="260" height="5" fill="#e2e8f0"/>
  <text x="388" y="72" font-family="sans-serif" font-size="22" font-weight="bold" fill="#0f172a">Course Guide</text>
  <rect x="388" y="84" width="300" height="6" fill="#cbd5e1"/>
  <text x="388" y="122" font-family="sans-serif" font-size="16" font-weight="bold" fill="#334155">1. Week 1 Overview</text>
  <rect x="388" y="132" width="280" height="5" fill="#e2e8f0"/>
  <rect x="388" y="144" width="250" height="5" fill="#e2e8f0"/>
  <text x="404" y="176" font-family="sans-serif" font-size="13" fill="#475569">1.1 What you will learn</text>
  <text x="404" y="196" font-family="sans-serif" font-size="13" fill="#475569">1.2 How to prepare</text>
  <text x="388" y="230" font-family="sans-serif" font-size="16" font-weight="bold" fill="#334155">2. Assessment</text>
  <rect x="388" y="240" width="270" height="5" fill="#e2e8f0"/>
  <rect x="388" y="252" width="230" height="5" fill="#e2e8f0"/>
</svg>`,
        options: [
          { text: "Option A" },
          { text: "Option B", correct: true },
          { text: "Both show structure equally well" },
          { text: "Neither - font colour is what matters" },
        ],
      },
      {
        type: "VISUAL",
        prompt: "Which screen is easier to read?",
        difficulty: 1,
        comps: [["VR", 2], ["AD", 1]],
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 300">
  <rect width="720" height="300" fill="#ffffff"/>
  <rect x="8" y="8" width="344" height="284" fill="#ffffff" stroke="#cbd5e1"/>
  <rect x="368" y="8" width="344" height="284" fill="#f8fafc" stroke="#cbd5e1"/>
  <text x="26" y="36" font-family="sans-serif" font-size="15" fill="#0f172a">Option A</text>
  <text x="386" y="36" font-family="sans-serif" font-size="15" fill="#0f172a">Option B</text>
  <text x="30" y="76" font-family="sans-serif" font-size="15" font-weight="bold" fill="#0f172a">Payment confirmed</text>
  <text x="30" y="104" font-family="sans-serif" font-size="13" fill="#334155">Your payment of N120,000 was received.</text>
  <text x="30" y="126" font-family="sans-serif" font-size="13" fill="#334155">A receipt has been emailed to you.</text>
  <text x="30" y="148" font-family="sans-serif" font-size="13" fill="#334155">Your class starts on Monday at 6pm.</text>
  <rect x="30" y="176" width="150" height="36" fill="#4f46e5"/>
  <text x="44" y="199" font-family="sans-serif" font-size="13" fill="#ffffff">Go to dashboard</text>
  <rect x="388" y="56" width="300" height="60" fill="#fde68a"/>
  <rect x="388" y="116" width="300" height="60" fill="#bfdbfe"/>
  <rect x="388" y="176" width="300" height="60" fill="#bbf7d0"/>
  <text x="400" y="84" font-family="sans-serif" font-size="13" fill="#fef3c7">Payment confirmed - check your</text>
  <text x="400" y="102" font-family="sans-serif" font-size="13" fill="#fef3c7">email for the receipt details</text>
  <text x="400" y="144" font-family="sans-serif" font-size="13" fill="#dbeafe">Class starts Monday 6pm - bring</text>
  <text x="400" y="162" font-family="sans-serif" font-size="13" fill="#dbeafe">your laptop if you have one</text>
  <text x="400" y="206" font-family="sans-serif" font-size="13" fill="#dcfce7">Go to dashboard - your courses</text>
  <text x="400" y="224" font-family="sans-serif" font-size="13" fill="#dcfce7">and projects are inside</text>
</svg>`,
        options: [
          { text: "Option A", correct: true },
          { text: "Option B" },
          { text: "Both are equally easy to read" },
          { text: "Neither - only font size matters" },
        ],
      },
      {
        type: "VISUAL",
        prompt: "Which is better for one-handed phone use?",
        difficulty: 2,
        comps: [["VR", 2], ["EM", 1]],
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 300">
  <rect width="720" height="300" fill="#ffffff"/>
  <rect x="8" y="8" width="344" height="284" fill="#f8fafc" stroke="#cbd5e1"/>
  <rect x="368" y="8" width="344" height="284" fill="#f8fafc" stroke="#cbd5e1"/>
  <text x="26" y="36" font-family="sans-serif" font-size="15" fill="#0f172a">Option A</text>
  <text x="386" y="36" font-family="sans-serif" font-size="15" fill="#0f172a">Option B</text>
  <rect x="30" y="60" width="72" height="22" fill="#e2e8f0" stroke="#94a3b8"/>
  <text x="42" y="75" font-family="sans-serif" font-size="10" fill="#334155">Back</text>
  <rect x="108" y="60" width="72" height="22" fill="#e2e8f0" stroke="#94a3b8"/>
  <text x="120" y="75" font-family="sans-serif" font-size="10" fill="#334155">Next</text>
  <rect x="186" y="60" width="72" height="22" fill="#e2e8f0" stroke="#94a3b8"/>
  <text x="198" y="75" font-family="sans-serif" font-size="10" fill="#334155">Save</text>
  <rect x="264" y="60" width="72" height="22" fill="#e2e8f0" stroke="#94a3b8"/>
  <text x="276" y="75" font-family="sans-serif" font-size="10" fill="#334155">Help</text>
  <rect x="30" y="94" width="72" height="22" fill="#e2e8f0" stroke="#94a3b8"/>
  <text x="42" y="109" font-family="sans-serif" font-size="10" fill="#334155">Share</text>
  <rect x="108" y="94" width="72" height="22" fill="#e2e8f0" stroke="#94a3b8"/>
  <text x="120" y="109" font-family="sans-serif" font-size="10" fill="#334155">Print</text>
  <rect x="186" y="94" width="72" height="22" fill="#e2e8f0" stroke="#94a3b8"/>
  <text x="198" y="109" font-family="sans-serif" font-size="10" fill="#334155">Close</text>
  <rect x="264" y="94" width="72" height="22" fill="#4f46e5"/>
  <text x="276" y="109" font-family="sans-serif" font-size="10" fill="#ffffff">OK</text>
  <rect x="390" y="60" width="280" height="52" fill="#e2e8f0" stroke="#94a3b8"/>
  <text x="406" y="92" font-family="sans-serif" font-size="14" fill="#334155">Back</text>
  <rect x="390" y="128" width="280" height="52" fill="#e2e8f0" stroke="#94a3b8"/>
  <text x="406" y="160" font-family="sans-serif" font-size="14" fill="#334155">Save and continue</text>
  <rect x="390" y="196" width="280" height="52" fill="#4f46e5"/>
  <text x="406" y="228" font-family="sans-serif" font-size="14" fill="#ffffff">Submit</text>
</svg>`,
        options: [
          { text: "Option A" },
          { text: "Option B", correct: true },
          { text: "Both are equally comfortable" },
          { text: "Neither - colour is all that matters" },
        ],
      },
      {
        type: "VISUAL",
        prompt: "Which form is less likely to lead to mistakes?",
        difficulty: 2,
        comps: [["VR", 2], ["PT", 1]],
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 320">
  <rect width="720" height="320" fill="#ffffff"/>
  <rect x="8" y="8" width="344" height="304" fill="#f8fafc" stroke="#cbd5e1"/>
  <rect x="368" y="8" width="344" height="304" fill="#f8fafc" stroke="#cbd5e1"/>
  <text x="26" y="36" font-family="sans-serif" font-size="15" fill="#0f172a">Option A</text>
  <text x="386" y="36" font-family="sans-serif" font-size="15" fill="#0f172a">Option B</text>
  <text x="30" y="66" font-family="sans-serif" font-size="13" font-weight="bold" fill="#4f46e5">1. Your details</text>
  <rect x="30" y="76" width="300" height="30" fill="#ffffff" stroke="#94a3b8"/>
  <rect x="30" y="114" width="300" height="30" fill="#ffffff" stroke="#94a3b8"/>
  <text x="30" y="166" font-family="sans-serif" font-size="13" font-weight="bold" fill="#4f46e5">2. Course choice</text>
  <rect x="30" y="176" width="300" height="30" fill="#ffffff" stroke="#94a3b8"/>
  <text x="30" y="232" font-family="sans-serif" font-size="13" font-weight="bold" fill="#4f46e5">3. Payment</text>
  <rect x="30" y="242" width="300" height="30" fill="#ffffff" stroke="#94a3b8"/>
  <text x="390" y="60" font-family="sans-serif" font-size="12" fill="#334155">Full name</text>
  <rect x="390" y="66" width="300" height="24" fill="#ffffff" stroke="#94a3b8"/>
  <text x="390" y="106" font-family="sans-serif" font-size="12" fill="#334155">Email</text>
  <rect x="390" y="112" width="300" height="24" fill="#ffffff" stroke="#94a3b8"/>
  <text x="390" y="152" font-family="sans-serif" font-size="12" fill="#334155">Phone</text>
  <rect x="390" y="158" width="300" height="24" fill="#ffffff" stroke="#94a3b8"/>
  <text x="390" y="198" font-family="sans-serif" font-size="12" fill="#334155">Address</text>
  <rect x="390" y="204" width="300" height="24" fill="#ffffff" stroke="#94a3b8"/>
  <text x="390" y="244" font-family="sans-serif" font-size="12" fill="#334155">Course</text>
  <rect x="390" y="250" width="300" height="24" fill="#ffffff" stroke="#94a3b8"/>
  <text x="390" y="290" font-family="sans-serif" font-size="12" fill="#334155">Card number</text>
  <rect x="390" y="296" width="300" height="14" fill="#ffffff" stroke="#94a3b8"/>
</svg>`,
        options: [
          { text: "Option A", correct: true },
          { text: "Option B" },
          { text: "Both are equally safe" },
          { text: "Neither - only colour matters" },
        ],
      },
      {
        type: "VISUAL",
        prompt: "Which screen helps the user know what to do next?",
        difficulty: 1,
        comps: [["VR", 2], ["CR", 1]],
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 280">
  <rect width="720" height="280" fill="#ffffff"/>
  <rect x="8" y="8" width="344" height="264" fill="#f8fafc" stroke="#cbd5e1"/>
  <rect x="368" y="8" width="344" height="264" fill="#f8fafc" stroke="#cbd5e1"/>
  <text x="26" y="36" font-family="sans-serif" font-size="15" fill="#0f172a">Option A</text>
  <text x="386" y="36" font-family="sans-serif" font-size="15" fill="#0f172a">Option B</text>
  <circle cx="180" cy="120" r="46" fill="#e2e8f0"/>
  <rect x="158" y="104" width="44" height="32" fill="#94a3b8"/>
  <text x="130" y="200" font-family="sans-serif" font-size="15" fill="#334155">No data</text>
  <circle cx="540" cy="110" r="42" fill="#e2e8f0"/>
  <rect x="520" y="96" width="40" height="28" fill="#94a3b8"/>
  <text x="446" y="184" font-family="sans-serif" font-size="15" font-weight="bold" fill="#0f172a">No projects yet</text>
  <text x="426" y="208" font-family="sans-serif" font-size="12" fill="#475569">Create your first project to start</text>
  <text x="426" y="224" font-family="sans-serif" font-size="12" fill="#475569">tracking your team's work.</text>
  <rect x="446" y="238" width="190" height="30" fill="#4f46e5"/>
  <text x="460" y="258" font-family="sans-serif" font-size="12" fill="#ffffff">Create your first project</text>
</svg>`,
        options: [
          { text: "Option A" },
          { text: "Option B", correct: true },
          { text: "Both guide the user equally well" },
          { text: "Neither - only animation would help" },
        ],
      },
    ],
  },
  // ---------------- SECTION F: Practical Problem-Solving Simulations -------
  {
    code: "F",
    name: "Practical Problem-Solving Simulations",
    description: "Realistic technology-related situations. Each option is scored 0-4.",
    component: "SIMULATION",
    weight: 20,
    questions: [
      {
        type: "SCENARIO",
        prompt:
          "A small training business wants clients to book appointment slots online. Slots must never be double-booked, and both sides should get a reminder. Which approach is best?",
        difficulty: 2,
        comps: [["PS", 2], ["ST", 1], ["PT", 1]],
        options: [
          {
            text: "Break it into steps: show only slots that are actually free, let the client choose, confirm with their contact details, hold the slot immediately, and remind both sides",
            score: 4,
          },
          {
            text: "Post a list of all slots on a page and ask clients to email their choice; a staff member updates a sheet twice a day",
            score: 2,
          },
          {
            text: "Keep using phone calls only until there is money to build everything at once",
            score: 1,
          },
          {
            text: "Allow anyone to book any slot and settle clashes when clients complain",
            score: 0,
          },
        ],
      },
      {
        type: "SCENARIO",
        prompt:
          "While reviewing a dataset you notice one week's sales figures are completely missing. What should you do first?",
        difficulty: 2,
        comps: [["AD", 2], ["NR", 1], ["IN", 1]],
        options: [
          {
            text: "Trace where the week went, confirm why it is missing, and record the decision before calculating anything",
            score: 4,
          },
          {
            text: "Mark the gap clearly, continue with the remaining weeks, and flag the limitation in the report",
            score: 2,
          },
          { text: "Fill it with the average of the other weeks so the data looks complete", score: 1 },
          { text: "Ignore the gap entirely; the rest is probably fine", score: 0 },
        ],
      },
      {
        type: "SCENARIO",
        prompt:
          "You receive an email that looks like it is from your school's portal, asking you to confirm your password through a link. What is the safest response?",
        difficulty: 1,
        comps: [["IN", 2], ["AD", 1], ["DM", 1]],
        options: [
          {
            text: "Do not click anything; report it to the IT/help desk and log in through the official website yourself",
            score: 4,
          },
          { text: "Reply to the email asking whether it is genuine", score: 1 },
          { text: "Forward it to friends to see if they received it too", score: 2 },
          { text: "Click the link and enter your details if the page looks official", score: 0 },
        ],
      },
      {
        type: "SCENARIO",
        prompt:
          "A company receives 300 job applications by email every month. Staff manually download CVs, extract names, update a spreadsheet, send confirmation emails and notify HR. How would you improve this process?",
        difficulty: 2,
        comps: [["ST", 2], ["PT", 2], ["PS", 1]],
        options: [
          {
            text: "Trigger on each new application email, extract the key details automatically, store them in one place, reply with an instant confirmation, and alert HR - with a person checking anything unclear",
            score: 4,
          },
          { text: "Assign all five tasks to one staff member every morning so they get done sooner", score: 2 },
          { text: "Use a spreadsheet template so typing the names is slightly faster", score: 1 },
          { text: "Keep the current process and hire an intern for a month", score: 0 },
        ],
      },
      {
        type: "SCENARIO",
        prompt:
          "Two senior stakeholders each want a different feature built first, and the team can only deliver one. What is the best approach?",
        difficulty: 2,
        comps: [["DM", 2], ["CM", 2], ["ST", 1]],
        options: [
          {
            text: "Get both to agree on the user problem and success measure, compare impact versus effort openly, then decide and explain the trade-off",
            score: 4,
          },
          { text: "Build both halfway so neither stakeholder feels ignored", score: 2 },
          { text: "Let the loudest stakeholder decide to keep the peace", score: 1 },
          { text: "Add both to the plan immediately and quietly drop something else", score: 0 },
        ],
      },
      {
        type: "SCENARIO",
        prompt:
          "An advertisement is getting plenty of clicks but almost no sign-ups. What should happen first?",
        difficulty: 2,
        comps: [["IN", 2], ["PS", 2], ["DM", 1]],
        options: [
          {
            text: "Check where people land after clicking and find where they drop off, then fix that step before spending more",
            score: 4,
          },
          { text: "Increase the budget so more people see the advert", score: 2 },
          { text: "Change the advert's colours every day and watch", score: 1 },
          { text: "Stop all advertising permanently", score: 0 },
        ],
      },
      {
        type: "SCENARIO",
        prompt:
          "Engagement on a training business's social page has been dropping for two months. What is the most sensible first move?",
        difficulty: 2,
        comps: [["IN", 2], ["DM", 1], ["CR", 1]],
        options: [
          {
            text: "Review which posts worked and when, ask the audience what they want, and test a couple of new formats",
            score: 4,
          },
          { text: "Post the exact same content more often, every day", score: 2 },
          { text: "Buy followers so the numbers look better", score: 0 },
          { text: "Delete the account and start a new one", score: 1 },
        ],
      },
      {
        type: "SCENARIO",
        prompt:
          "Many users abandon a registration form at step 3 of 5. What is the best response?",
        difficulty: 2,
        comps: [["EM", 2], ["VR", 1], ["PS", 1]],
        options: [
          {
            text: "Find out exactly what happens at step 3 (fields, errors, confusion), simplify it, and test the change with real users",
            score: 4,
          },
          { text: "Move step 3 to the end of the form", score: 2 },
          { text: "Add a warning telling users to try harder", score: 1 },
          { text: "Remove the form and ask users to register by email instead", score: 0 },
        ],
      },
      {
        type: "SCENARIO",
        prompt:
          "Two companies need to share a record of deliveries that neither side can secretly change afterwards. Which approach fits best?",
        difficulty: 3,
        comps: [["ST", 2], ["AB", 1], ["AD", 1]],
        options: [
          {
            text: "Give both companies access to the same append-only ledger where every entry is verified and visible to both sides",
            score: 4,
          },
          { text: "Each keeps its own spreadsheet and they email copies weekly", score: 2 },
          { text: "One company keeps the only copy and promises not to edit it", score: 1 },
          { text: "Store the record in a shared file that anyone can overwrite", score: 0 },
        ],
      },
      {
        type: "OPEN_ENDED",
        prompt:
          "A community training centre is losing track of student payments and attendance. Describe, in your own words, how you would organise this from start to finish. No technical knowledge is required - think about what information you would keep, who would check it, and how problems would be caught early.",
        difficulty: 3,
        comps: [["ST", 2], ["PS", 2], ["PT", 1]],
        requiresManualScore: true,
        options: [],
      },
    ],
  },

  // ---------------- SECTION G: Behaviour & Learning Style ------------------
  {
    code: "G",
    name: "Behaviour & Learning Style",
    description: "How you typically approach difficulty, uncertainty and experimentation.",
    component: "BEHAVIOUR",
    weight: 8,
    questions: [
      {
        type: "LIKERT",
        prompt: "When a step in my plan keeps failing, I try a different approach before I give up.",
        difficulty: 1,
        comps: [["PE", 1.5]],
        options: likert(),
      },
      {
        type: "LIKERT",
        prompt: "I often make a small change first just to see what happens.",
        difficulty: 1,
        comps: [["EX", 1.5]],
        options: likert(),
      },
      {
        type: "LIKERT",
        prompt: "I want to understand why something works, not only copy what someone showed me.",
        difficulty: 1,
        comps: [["EX", 1.2], ["PE", 0.8]],
        options: likert(),
      },
      {
        type: "LIKERT",
        prompt: "When instructions are unclear, I usually work it out by trying things.",
        difficulty: 1,
        comps: [["EX", 1.2], ["IN", 1]],
        options: likert(),
      },
      {
        type: "LIKERT",
        prompt: "I can keep working on a problem even when I do not know the answer yet.",
        difficulty: 1,
        comps: [["PE", 1.5], ["DM", 0.8]],
        options: likert(),
      },
    ],
  },
  // ---------------- SECTION H: Career Interest (forced choice) -------------
  {
    code: "H",
    name: "Career Interest",
    description: "Activities, not course names. Interest contributes a small share of the final score.",
    component: "INTEREST",
    weight: 5,
    questions: [
      {
        type: "MULTIPLE_CHOICE",
        prompt: "Which of these activities sounds most interesting to you?",
        difficulty: 1,
        comps: [],
        options: [
          { text: "Find patterns in a large set of data", map: { data_analysis: 100, data_science: 90, digital_marketing: 40 } },
          { text: "Build a system that lets people do something online", map: { backend_development: 100, frontend_development: 65, blockchain_development: 55, mobile_development: 45 } },
          { text: "Investigate unusual activity on a computer network", map: { cybersecurity: 100, backend_development: 40 } },
          { text: "Design how an application looks and works", map: { ui_ux_design: 100, product_design: 85, frontend_development: 50 } },
        ],
      },
      {
        type: "MULTIPLE_CHOICE",
        prompt: "If you had a free afternoon to work on something useful, which would you pick?",
        difficulty: 1,
        comps: [],
        options: [
          { text: "Decide what a team should build next and in what order", map: { product_management: 100, product_design: 55 } },
          { text: "Create posts and videos that grow an audience", map: { social_media_marketing: 100, digital_marketing: 80 } },
          { text: "Make sense of messy spreadsheets and find what matters", map: { data_analysis: 100, data_science: 80, ai_workflow_automation: 35 } },
          { text: "Create visual designs and promotional graphics for a brand", map: { product_design: 100, digital_marketing: 75, ui_ux_design: 55 } },
        ],
      },
      {
        type: "MULTIPLE_CHOICE",
        prompt: "Which kind of result would you be most proud of producing?",
        difficulty: 1,
        comps: [],
        options: [
          { text: "Something that runs on people's phones", map: { mobile_development: 100, frontend_development: 60 } },
          { text: "A website whose screens are genuinely easy to use", map: { ui_ux_design: 100, product_design: 70, frontend_development: 55 } },
          { text: "Automatic reminders and reports that run without anyone chasing them", map: { ai_workflow_automation: 100, backend_development: 60, product_management: 40 } },
          { text: "Protection that keeps a company's information out of the wrong hands", map: { cybersecurity: 100, backend_development: 45 } },
        ],
      },
      {
        type: "MULTIPLE_CHOICE",
        prompt: "Which of these problems would you most enjoy being handed?",
        difficulty: 1,
        comps: [],
        options: [
          { text: "Explain a complicated idea so anyone can understand it", map: { product_management: 85, digital_marketing: 55, social_media_marketing: 55 } },
          { text: "Watch people struggle with a tool and redesign it", map: { ui_ux_design: 100, product_design: 75, product_management: 60 } },
          { text: "Connect two systems so information moves between them automatically", map: { ai_workflow_automation: 100, backend_development: 85, blockchain_development: 45 } },
          { text: "Predict next month's sales from past numbers", map: { data_analysis: 100, data_science: 90 } },
        ],
      },
    ],
  },

  // ---------------- SECTION I: Motivation & Persistence -------------------
  {
    code: "I",
    name: "Motivation & Persistence",
    description: "Response to failure, feedback, research and intrinsic learning motivation.",
    component: "MOTIVATION",
    weight: 5,
    questions: [
      {
        type: "LIKERT",
        prompt: "After someone points out a weakness in my work, I usually apply it to the next attempt.",
        difficulty: 1,
        comps: [["PE", 1.5]],
        options: likert(),
      },
      {
        type: "LIKERT",
        prompt: "A course exercise takes much longer than I expected. I am likely to keep going past the time I planned.",
        difficulty: 1,
        comps: [["PE", 1.5]],
        options: likert(),
      },
      {
        type: "LIKERT",
        prompt: "When a topic is not clear, I look for extra explanations on my own.",
        difficulty: 1,
        comps: [["EX", 1.5], ["IN", 0.8]],
        options: likert(),
      },
      {
        type: "LIKERT",
        prompt: "Learning something new matters to me even when nobody is checking.",
        difficulty: 1,
        comps: [["PE", 1]],
        options: likert(),
      },
      {
        type: "LIKERT",
        prompt: "When several tasks compete for my time, I decide what comes first by thinking about what matters most.",
        difficulty: 1,
        comps: [["DM", 1.5]],
        options: likert(),
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Version / link seeding
// ---------------------------------------------------------------------------

const PUBLIC_LINK_TOKEN = "tech-aptitude-1";
// Content changes are versioned so historical candidate attempts remain
// reproducible. Version 1.1 carries the Africinnovate branding correction.
const SEED_VERSION_NUMBER = "1.1";

async function ensureAssessmentLink(versionId: string) {
  await db.assessment.upsert({
    where: { token: PUBLIC_LINK_TOKEN },
    update: { assessmentVersionId: versionId, status: "ACTIVE" },
    create: {
      token: PUBLIC_LINK_TOKEN,
      title: "Technology Career Aptitude Assessment",
      assessmentVersionId: versionId,
      status: "ACTIVE",
    },
  });
}

async function seedAssessmentVersion() {
  const competencies = await db.competency.findMany();
  const codeToId = Object.fromEntries(competencies.map((c) => [c.code, c.id]));

  const existing = await db.assessmentVersion.findFirst({
    where: { versionNumber: SEED_VERSION_NUMBER },
  });
  if (existing) {
    await ensureAssessmentLink(existing.id);
    console.log(`assessment version ${SEED_VERSION_NUMBER} already present - content seed skipped`);
    return;
  }

  const version = await db.assessmentVersion.create({
    data: {
      versionName: "Technology Aptitude Assessment",
      versionNumber: SEED_VERSION_NUMBER,
      status: "DRAFT",
      notes: "Africinnovate-branded MVP release - 65 questions across 9 sections.",
    },
  });

  let questionCount = 0;
  for (const [sIdx, s] of SECTIONS.entries()) {
    const section = await db.section.create({
      data: {
        assessmentVersionId: version.id,
        code: s.code,
        name: s.name,
        description: s.description,
        component: s.component,
        weight: s.weight,
        position: sIdx + 1,
      },
    });

    for (const [qIdx, q] of s.questions.entries()) {
      questionCount += 1;
      const question = await db.question.create({
        data: {
          sectionId: section.id,
          position: qIdx + 1,
          type: q.type,
          prompt: q.prompt,
          stimulus: q.stimulus ?? null,
          stimulusSvg: q.svg ?? null,
          difficulty: q.difficulty ?? 2,
          requiresManualScore: q.requiresManualScore ?? false,
          itemsJson: q.items
            ? JSON.stringify(
                q.items.map((text, i) => ({
                  id: `q${questionCount}-item${i + 1}`,
                  text,
                  correctPosition: i,
                })),
              )
            : null,
        },
      });

      const options = q.options ?? [];
      for (const [oIdx, o] of options.entries()) {
        await db.questionOption.create({
          data: {
            questionId: question.id,
            text: o.text,
            position: oIdx,
            isCorrect: !!o.correct,
            score: o.score ?? (q.type === "LIKERT" ? oIdx + 1 : 0),
            mapJson: o.map ? JSON.stringify({ courses: o.map }) : null,
          },
        });
      }

      for (const [code, weight] of q.comps) {
        const competencyId = codeToId[code];
        if (!competencyId) throw new Error(`Unknown competency code: ${code}`);
        await db.questionCompetency.create({
          data: { questionId: question.id, competencyId, weight },
        });
      }
    }
  }

  await db.assessmentVersion.update({
    where: { id: version.id },
    data: { status: "PUBLISHED", publishedAt: new Date() },
  });
  await ensureAssessmentLink(version.id);
  console.log(
    `assessment version ${SEED_VERSION_NUMBER} published: ${SECTIONS.length} sections, ${questionCount} questions`,
  );
}

async function main() {
  console.log("Seeding Africinnovate Technology Career Aptitude Assessment...");
  await seedSettings();
  await seedCompetencies();
  await seedCourses();
  await seedUsers();
  await seedAssessmentVersion();

  const counts = {
    questions: await db.question.count(),
    courses: await db.course.count(),
    competencies: await db.competency.count(),
    weights: await db.courseCompetencyWeight.count(),
  };
  console.log("counts:", counts);
  console.log("");
  console.log(`Public assessment link : /a/${PUBLIC_LINK_TOKEN}`);
  console.log("Admin login            : admin@africinnovate.com / Admin123!");
  console.log("Admissions login       : admissions@africinnovate.com / Admissions123!");
  console.log("Instructor login       : instructor@africinnovate.com / Instructor123!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
