-- Add IMPORTED values to status and classification enums
ALTER TYPE "RequirementStatus" ADD VALUE 'IMPORTED';
ALTER TYPE "RequirementClassification" ADD VALUE 'IMPORTED';

-- Remove the no-longer-used category field
ALTER TABLE "requirements" DROP COLUMN IF EXISTS "category";
ALTER TABLE "requirement_versions" DROP COLUMN IF EXISTS "category";
