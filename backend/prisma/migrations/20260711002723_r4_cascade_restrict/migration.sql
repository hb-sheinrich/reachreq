-- DropForeignKey
ALTER TABLE "ai_reviews" DROP CONSTRAINT "ai_reviews_author_id_fkey";

-- DropForeignKey
ALTER TABLE "ai_reviews" DROP CONSTRAINT "ai_reviews_glossary_entry_id_fkey";

-- DropForeignKey
ALTER TABLE "ai_reviews" DROP CONSTRAINT "ai_reviews_requirement_id_fkey";

-- DropForeignKey
ALTER TABLE "comment_mentions" DROP CONSTRAINT "comment_mentions_user_id_fkey";

-- DropForeignKey
ALTER TABLE "comments" DROP CONSTRAINT "comments_author_id_fkey";

-- DropForeignKey
ALTER TABLE "glossary_entries" DROP CONSTRAINT "glossary_entries_author_id_fkey";

-- DropForeignKey
ALTER TABLE "glossary_versions" DROP CONSTRAINT "glossary_versions_author_id_fkey";

-- DropForeignKey
ALTER TABLE "requirement_glossary_links" DROP CONSTRAINT "requirement_glossary_links_glossary_entry_id_fkey";

-- DropForeignKey
ALTER TABLE "requirement_glossary_links" DROP CONSTRAINT "requirement_glossary_links_requirement_id_fkey";

-- DropForeignKey
ALTER TABLE "requirement_links" DROP CONSTRAINT "requirement_links_from_id_fkey";

-- DropForeignKey
ALTER TABLE "requirement_links" DROP CONSTRAINT "requirement_links_to_id_fkey";

-- DropForeignKey
ALTER TABLE "requirement_versions" DROP CONSTRAINT "requirement_versions_author_id_fkey";

-- DropForeignKey
ALTER TABLE "requirements" DROP CONSTRAINT "requirements_author_id_fkey";

-- DropForeignKey
ALTER TABLE "translations" DROP CONSTRAINT "translations_glossary_entry_id_fkey";

-- DropForeignKey
ALTER TABLE "translations" DROP CONSTRAINT "translations_requirement_id_fkey";

-- AddForeignKey
ALTER TABLE "requirements" ADD CONSTRAINT "requirements_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_versions" ADD CONSTRAINT "requirement_versions_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_links" ADD CONSTRAINT "requirement_links_from_id_fkey" FOREIGN KEY ("from_id") REFERENCES "requirements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_links" ADD CONSTRAINT "requirement_links_to_id_fkey" FOREIGN KEY ("to_id") REFERENCES "requirements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_glossary_links" ADD CONSTRAINT "requirement_glossary_links_requirement_id_fkey" FOREIGN KEY ("requirement_id") REFERENCES "requirements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_glossary_links" ADD CONSTRAINT "requirement_glossary_links_glossary_entry_id_fkey" FOREIGN KEY ("glossary_entry_id") REFERENCES "glossary_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment_mentions" ADD CONSTRAINT "comment_mentions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "glossary_entries" ADD CONSTRAINT "glossary_entries_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "glossary_versions" ADD CONSTRAINT "glossary_versions_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "translations" ADD CONSTRAINT "translations_requirement_id_fkey" FOREIGN KEY ("requirement_id") REFERENCES "requirements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "translations" ADD CONSTRAINT "translations_glossary_entry_id_fkey" FOREIGN KEY ("glossary_entry_id") REFERENCES "glossary_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_reviews" ADD CONSTRAINT "ai_reviews_requirement_id_fkey" FOREIGN KEY ("requirement_id") REFERENCES "requirements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_reviews" ADD CONSTRAINT "ai_reviews_glossary_entry_id_fkey" FOREIGN KEY ("glossary_entry_id") REFERENCES "glossary_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_reviews" ADD CONSTRAINT "ai_reviews_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
