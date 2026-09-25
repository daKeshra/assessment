-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'ADMIN',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT,
    "entityId" TEXT,
    "metaJson" TEXT,
    "ipAddress" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "group" TEXT NOT NULL DEFAULT 'general',
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'string',
    "options" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AssessmentVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "versionName" TEXT NOT NULL,
    "versionNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" DATETIME
);

-- CreateTable
CREATE TABLE "Assessment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "assessmentVersionId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Assessment_assessmentVersionId_fkey" FOREIGN KEY ("assessmentVersionId") REFERENCES "AssessmentVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Section" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assessmentVersionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "component" TEXT NOT NULL,
    "weight" REAL NOT NULL,
    "position" INTEGER NOT NULL,
    CONSTRAINT "Section_assessmentVersionId_fkey" FOREIGN KEY ("assessmentVersionId") REFERENCES "AssessmentVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sectionId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "stimulus" TEXT,
    "stimulusSvg" TEXT,
    "difficulty" INTEGER NOT NULL DEFAULT 2,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "itemsJson" TEXT,
    "requiresManualScore" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Question_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuestionOption" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "questionId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "score" INTEGER NOT NULL DEFAULT 0,
    "mapJson" TEXT,
    CONSTRAINT "QuestionOption_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Competency" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "QuestionCompetency" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "questionId" TEXT NOT NULL,
    "competencyId" TEXT NOT NULL,
    "weight" REAL NOT NULL DEFAULT 1,
    CONSTRAINT "QuestionCompetency_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuestionCompetency_competencyId_fkey" FOREIGN KEY ("competencyId") REFERENCES "Competency" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courseCode" TEXT NOT NULL,
    "courseName" TEXT NOT NULL,
    "description" TEXT,
    "careerFamily" TEXT,
    "ctaUrl" TEXT,
    "progressionJson" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "minimumScore" REAL NOT NULL DEFAULT 65,
    "displayOrder" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "CourseCompetencyWeight" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courseId" TEXT NOT NULL,
    "competencyId" TEXT NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "CourseCompetencyWeight_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CourseCompetencyWeight_competencyId_fkey" FOREIGN KEY ("competencyId") REFERENCES "Competency" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Candidate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "educationLevel" TEXT NOT NULL,
    "occupation" TEXT NOT NULL,
    "ageRange" TEXT,
    "techExposure" TEXT,
    "hoursPerWeek" TEXT,
    "preferredFormat" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Attempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "assessmentVersionId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "startTime" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submissionTime" DATETIME,
    "durationSeconds" INTEGER,
    "lastActivityAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "questionOrderJson" TEXT,
    "optionOrderJson" TEXT,
    "itemOrderJson" TEXT,
    "sectionStartsJson" TEXT,
    "currentQuestionId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "flagsJson" TEXT,
    CONSTRAINT "Attempt_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Attempt_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Attempt_assessmentVersionId_fkey" FOREIGN KEY ("assessmentVersionId") REFERENCES "AssessmentVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Response" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "selectedOptionIds" TEXT,
    "textResponse" TEXT,
    "timeSpentMs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Response_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Response_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ResponseScore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "responseId" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "rawScore" REAL NOT NULL,
    "aiScore" REAL,
    "aiRationale" TEXT,
    "aiConfidence" REAL,
    "aiModel" TEXT,
    "aiGeneratedAt" DATETIME,
    "aiPromptVersion" TEXT,
    "humanScore" REAL,
    "finalScore" REAL NOT NULL,
    "reviewedById" TEXT,
    "reviewedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ResponseScore_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "Response" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ResponseScore_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ResponseScore_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ResponseScore_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CompetencyScore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "attemptId" TEXT NOT NULL,
    "competencyId" TEXT NOT NULL,
    "score" REAL NOT NULL,
    CONSTRAINT "CompetencyScore_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CompetencyScore_competencyId_fkey" FOREIGN KEY ("competencyId") REFERENCES "Competency" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CourseScore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "attemptId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "score" REAL NOT NULL,
    "rank" INTEGER NOT NULL,
    "fitJson" TEXT,
    CONSTRAINT "CourseScore_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CourseScore_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Recommendation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "attemptId" TEXT NOT NULL,
    "primaryCourseId" TEXT,
    "secondaryCourseIds" TEXT,
    "profileType" TEXT NOT NULL,
    "profileFamily" TEXT,
    "confidence" TEXT NOT NULL,
    "confidenceValue" REAL,
    "explanationJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Recommendation_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Recommendation_primaryCourseId_fkey" FOREIGN KEY ("primaryCourseId") REFERENCES "Course" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AssessmentEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "attemptId" TEXT,
    "courseId" TEXT,
    "metadataJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssessmentEvent_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AssessmentEvent_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AssessmentReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "attemptId" TEXT NOT NULL,
    "overallScore" REAL NOT NULL,
    "completeness" REAL NOT NULL,
    "simulationScore" REAL,
    "componentScoresJson" TEXT,
    "sectionScoresJson" TEXT,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssessmentReport_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Assessment_token_key" ON "Assessment"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Competency_code_key" ON "Competency"("code");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionCompetency_questionId_competencyId_key" ON "QuestionCompetency"("questionId", "competencyId");

-- CreateIndex
CREATE UNIQUE INDEX "Course_courseCode_key" ON "Course"("courseCode");

-- CreateIndex
CREATE UNIQUE INDEX "CourseCompetencyWeight_courseId_competencyId_key" ON "CourseCompetencyWeight"("courseId", "competencyId");

-- CreateIndex
CREATE UNIQUE INDEX "Attempt_token_key" ON "Attempt"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Attempt_candidateId_assessmentId_key" ON "Attempt"("candidateId", "assessmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Response_attemptId_questionId_key" ON "Response"("attemptId", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "ResponseScore_responseId_key" ON "ResponseScore"("responseId");

-- CreateIndex
CREATE UNIQUE INDEX "CompetencyScore_attemptId_competencyId_key" ON "CompetencyScore"("attemptId", "competencyId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseScore_attemptId_courseId_key" ON "CourseScore"("attemptId", "courseId");

-- CreateIndex
CREATE UNIQUE INDEX "Recommendation_attemptId_key" ON "Recommendation"("attemptId");

-- CreateIndex
CREATE INDEX "AssessmentEvent_type_createdAt_idx" ON "AssessmentEvent"("type", "createdAt");

-- CreateIndex
CREATE INDEX "AssessmentEvent_attemptId_idx" ON "AssessmentEvent"("attemptId");

-- CreateIndex
CREATE INDEX "AssessmentEvent_courseId_idx" ON "AssessmentEvent"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentReport_attemptId_key" ON "AssessmentReport"("attemptId");

