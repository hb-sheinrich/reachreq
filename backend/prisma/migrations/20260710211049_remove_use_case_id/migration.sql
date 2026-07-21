/*
  Warnings:

  - You are about to drop the column `use_case_id` on the `requirement_versions` table. All the data in the column will be lost.
  - You are about to drop the column `use_case_id` on the `requirements` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "requirement_versions_module_id_use_case_id_key";

-- DropIndex
DROP INDEX "requirements_module_id_use_case_id_key";

-- AlterTable
ALTER TABLE "requirement_versions" DROP COLUMN "use_case_id";

-- AlterTable
ALTER TABLE "requirements" DROP COLUMN "use_case_id";
