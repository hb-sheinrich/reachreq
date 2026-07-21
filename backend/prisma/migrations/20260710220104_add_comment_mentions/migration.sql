-- CreateTable
CREATE TABLE "comment_mentions" (
    "id" TEXT NOT NULL,
    "comment_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "comment_mentions_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "comment_mentions" ADD CONSTRAINT "comment_mentions_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment_mentions" ADD CONSTRAINT "comment_mentions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
