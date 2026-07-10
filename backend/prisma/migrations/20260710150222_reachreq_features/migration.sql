-- AlterTable
ALTER TABLE "requirements" ADD COLUMN     "alternative_flows" JSONB,
ADD COLUMN     "category" TEXT,
ADD COLUMN     "goal" TEXT,
ADD COLUMN     "jira_issue_created_at" TIMESTAMP(3),
ADD COLUMN     "jira_issue_key" TEXT,
ADD COLUMN     "jira_issue_url" TEXT,
ADD COLUMN     "main_flow" JSONB,
ADD COLUMN     "original_language" TEXT DEFAULT 'de',
ADD COLUMN     "postcondition" TEXT,
ADD COLUMN     "precondition" TEXT,
ADD COLUMN     "reviewed_at_asc_she" TIMESTAMP(3),
ADD COLUMN     "reviewed_at_ce" TIMESTAMP(3),
ADD COLUMN     "reviewed_by_asc_she" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reviewed_by_ce" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reviewer_asc_she_id" TEXT,
ADD COLUMN     "reviewer_ce_id" TEXT,
ADD COLUMN     "technical_appendix" JSONB,
ADD COLUMN     "use_case_id" TEXT;

-- AlterTable
ALTER TABLE "requirement_versions" ADD COLUMN     "alternative_flows" JSONB,
ADD COLUMN     "category" TEXT,
ADD COLUMN     "change_type" TEXT,
ADD COLUMN     "diff" JSONB,
ADD COLUMN     "goal" TEXT,
ADD COLUMN     "jira_issue_created_at" TIMESTAMP(3),
ADD COLUMN     "jira_issue_key" TEXT,
ADD COLUMN     "jira_issue_url" TEXT,
ADD COLUMN     "main_flow" JSONB,
ADD COLUMN     "original_language" TEXT DEFAULT 'de',
ADD COLUMN     "postcondition" TEXT,
ADD COLUMN     "precondition" TEXT,
ADD COLUMN     "reviewed_at_asc_she" TIMESTAMP(3),
ADD COLUMN     "reviewed_at_ce" TIMESTAMP(3),
ADD COLUMN     "reviewed_by_asc_she" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reviewed_by_ce" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reviewer_asc_she_id" TEXT,
ADD COLUMN     "reviewer_ce_id" TEXT,
ADD COLUMN     "status" "RequirementStatus",
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "technical_appendix" JSONB,
ADD COLUMN     "use_case_id" TEXT;

-- AlterTable
ALTER TABLE "glossary_entries" ADD COLUMN     "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "original_language" TEXT DEFAULT 'de';

-- AlterTable
ALTER TABLE "glossary_versions" ADD COLUMN     "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "original_language" TEXT DEFAULT 'de';

-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requirement_tags" (
    "requirement_id" TEXT NOT NULL,
    "tag_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "requirement_tags_pkey" PRIMARY KEY ("requirement_id","tag_id")
);

-- CreateTable
CREATE TABLE "translations" (
    "id" TEXT NOT NULL,
    "requirement_id" TEXT,
    "glossary_entry_id" TEXT,
    "language" TEXT NOT NULL,
    "title" TEXT,
    "term" TEXT,
    "definition" TEXT,
    "description" TEXT,
    "context" TEXT,
    "acceptance_criteria" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "goal" TEXT,
    "precondition" TEXT,
    "postcondition" TEXT,
    "main_flow" JSONB,
    "alternative_flows" JSONB,
    "technical_appendix" JSONB,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "translations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tags_name_key" ON "tags"("name");

-- CreateIndex
CREATE UNIQUE INDEX "translations_requirement_id_language_key" ON "translations"("requirement_id", "language");

-- CreateIndex
CREATE UNIQUE INDEX "translations_glossary_entry_id_language_key" ON "translations"("glossary_entry_id", "language");

-- CreateIndex
CREATE UNIQUE INDEX "requirements_module_id_use_case_id_key" ON "requirements"("module_id", "use_case_id");

-- CreateIndex
CREATE UNIQUE INDEX "requirement_versions_module_id_use_case_id_key" ON "requirement_versions"("module_id", "use_case_id");

-- AddForeignKey
ALTER TABLE "requirement_tags" ADD CONSTRAINT "requirement_tags_requirement_id_fkey" FOREIGN KEY ("requirement_id") REFERENCES "requirements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_tags" ADD CONSTRAINT "requirement_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirements" ADD CONSTRAINT "requirements_reviewer_ce_id_fkey" FOREIGN KEY ("reviewer_ce_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirements" ADD CONSTRAINT "requirements_reviewer_asc_she_id_fkey" FOREIGN KEY ("reviewer_asc_she_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_versions" ADD CONSTRAINT "requirement_versions_reviewer_ce_id_fkey" FOREIGN KEY ("reviewer_ce_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_versions" ADD CONSTRAINT "requirement_versions_reviewer_asc_she_id_fkey" FOREIGN KEY ("reviewer_asc_she_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "translations" ADD CONSTRAINT "translations_requirement_id_fkey" FOREIGN KEY ("requirement_id") REFERENCES "requirements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "translations" ADD CONSTRAINT "translations_glossary_entry_id_fkey" FOREIGN KEY ("glossary_entry_id") REFERENCES "glossary_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

