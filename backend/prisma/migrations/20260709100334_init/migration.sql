-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'CONTRIBUTOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "RequirementStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'SUBMITTED_FOR_RELEASE', 'APPROVED', 'REJECTED', 'POSTPONED');

-- CreateEnum
CREATE TYPE "RequirementClassification" AS ENUM ('MUST_HAVE', 'SHOULD_HAVE', 'NICE_TO_HAVE', 'WONT_HAVE');

-- CreateEnum
CREATE TYPE "CommentStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateEnum
CREATE TYPE "LinkType" AS ENUM ('DEPENDENCY', 'CONFLICT', 'DUPLICATE', 'RELATED');

-- CreateEnum
CREATE TYPE "GlossaryStatus" AS ENUM ('DRAFT', 'SUBMITTED_FOR_RELEASE', 'APPROVED', 'REJECTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AIReviewStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "azure_ad_object_id" TEXT,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'CONTRIBUTOR',
    "locale" TEXT NOT NULL DEFAULT 'de',
    "theme" TEXT NOT NULL DEFAULT 'light',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "parent_id" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "sequence_counter" INTEGER NOT NULL DEFAULT 0,
    "path" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requirements" (
    "id" TEXT NOT NULL,
    "human_readable_id" TEXT NOT NULL,
    "module_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "context" TEXT,
    "acceptance_criteria" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "classification" "RequirementClassification" NOT NULL,
    "status" "RequirementStatus" NOT NULL DEFAULT 'DRAFT',
    "source" TEXT,
    "author_id" TEXT NOT NULL,
    "current_version_id" TEXT,
    "frozen_by_id" TEXT,
    "frozen_at" TIMESTAMP(3),
    "status_comment" TEXT,
    "edit_version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requirement_versions" (
    "id" TEXT NOT NULL,
    "requirement_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "change_comment" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "context" TEXT,
    "acceptance_criteria" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "classification" "RequirementClassification" NOT NULL,
    "module_id" TEXT NOT NULL,
    "source" TEXT,
    "author_id" TEXT NOT NULL,
    "ai_review_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "requirement_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requirement_links" (
    "id" TEXT NOT NULL,
    "from_id" TEXT NOT NULL,
    "to_id" TEXT NOT NULL,
    "type" "LinkType" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "requirement_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requirement_glossary_links" (
    "requirement_id" TEXT NOT NULL,
    "glossary_entry_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "requirement_glossary_links_pkey" PRIMARY KEY ("requirement_id","glossary_entry_id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" TEXT NOT NULL,
    "requirement_id" TEXT,
    "glossary_entry_id" TEXT,
    "version_id" TEXT,
    "text_anchor" JSONB,
    "content" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "status" "CommentStatus" NOT NULL DEFAULT 'OPEN',
    "parent_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "glossary_entries" (
    "id" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "definition" TEXT NOT NULL,
    "example" TEXT,
    "status" "GlossaryStatus" NOT NULL DEFAULT 'DRAFT',
    "tags" TEXT[],
    "module_id" TEXT,
    "author_id" TEXT NOT NULL,
    "current_version_id" TEXT,
    "status_comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "glossary_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "glossary_versions" (
    "id" TEXT NOT NULL,
    "glossary_entry_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "change_comment" TEXT,
    "term" TEXT NOT NULL,
    "definition" TEXT NOT NULL,
    "example" TEXT,
    "tags" TEXT[],
    "status" "GlossaryStatus" NOT NULL,
    "author_id" TEXT NOT NULL,
    "ai_review_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "glossary_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_reviews" (
    "id" TEXT NOT NULL,
    "requirement_id" TEXT,
    "glossary_entry_id" TEXT,
    "author_id" TEXT NOT NULL,
    "status" "AIReviewStatus" NOT NULL DEFAULT 'PENDING',
    "result" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "action" TEXT NOT NULL,
    "user_id" TEXT,
    "details" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "modules_code_key" ON "modules"("code");

-- CreateIndex
CREATE UNIQUE INDEX "requirements_human_readable_id_key" ON "requirements"("human_readable_id");

-- CreateIndex
CREATE UNIQUE INDEX "requirements_current_version_id_key" ON "requirements"("current_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "requirement_versions_requirement_id_version_number_key" ON "requirement_versions"("requirement_id", "version_number");

-- CreateIndex
CREATE UNIQUE INDEX "requirement_links_from_id_to_id_type_key" ON "requirement_links"("from_id", "to_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "glossary_entries_term_key" ON "glossary_entries"("term");

-- CreateIndex
CREATE UNIQUE INDEX "glossary_entries_current_version_id_key" ON "glossary_entries"("current_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "glossary_versions_glossary_entry_id_version_number_key" ON "glossary_versions"("glossary_entry_id", "version_number");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- AddForeignKey
ALTER TABLE "modules" ADD CONSTRAINT "modules_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "modules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirements" ADD CONSTRAINT "requirements_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "modules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirements" ADD CONSTRAINT "requirements_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirements" ADD CONSTRAINT "requirements_current_version_id_fkey" FOREIGN KEY ("current_version_id") REFERENCES "requirement_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirements" ADD CONSTRAINT "requirements_frozen_by_id_fkey" FOREIGN KEY ("frozen_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_versions" ADD CONSTRAINT "requirement_versions_requirement_id_fkey" FOREIGN KEY ("requirement_id") REFERENCES "requirements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_versions" ADD CONSTRAINT "requirement_versions_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_versions" ADD CONSTRAINT "requirement_versions_ai_review_id_fkey" FOREIGN KEY ("ai_review_id") REFERENCES "ai_reviews"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_links" ADD CONSTRAINT "requirement_links_from_id_fkey" FOREIGN KEY ("from_id") REFERENCES "requirements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_links" ADD CONSTRAINT "requirement_links_to_id_fkey" FOREIGN KEY ("to_id") REFERENCES "requirements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_glossary_links" ADD CONSTRAINT "requirement_glossary_links_requirement_id_fkey" FOREIGN KEY ("requirement_id") REFERENCES "requirements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_glossary_links" ADD CONSTRAINT "requirement_glossary_links_glossary_entry_id_fkey" FOREIGN KEY ("glossary_entry_id") REFERENCES "glossary_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_requirement_id_fkey" FOREIGN KEY ("requirement_id") REFERENCES "requirements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_glossary_entry_id_fkey" FOREIGN KEY ("glossary_entry_id") REFERENCES "glossary_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "glossary_entries" ADD CONSTRAINT "glossary_entries_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "glossary_entries" ADD CONSTRAINT "glossary_entries_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "modules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "glossary_entries" ADD CONSTRAINT "glossary_entries_current_version_id_fkey" FOREIGN KEY ("current_version_id") REFERENCES "glossary_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "glossary_versions" ADD CONSTRAINT "glossary_versions_glossary_entry_id_fkey" FOREIGN KEY ("glossary_entry_id") REFERENCES "glossary_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "glossary_versions" ADD CONSTRAINT "glossary_versions_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "glossary_versions" ADD CONSTRAINT "glossary_versions_ai_review_id_fkey" FOREIGN KEY ("ai_review_id") REFERENCES "ai_reviews"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_reviews" ADD CONSTRAINT "ai_reviews_requirement_id_fkey" FOREIGN KEY ("requirement_id") REFERENCES "requirements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_reviews" ADD CONSTRAINT "ai_reviews_glossary_entry_id_fkey" FOREIGN KEY ("glossary_entry_id") REFERENCES "glossary_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_reviews" ADD CONSTRAINT "ai_reviews_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
