import { SQLDatabase } from "encore.dev/storage/sqldb";

export const pptxDB = new SQLDatabase("pptx", {
  migrations: "./migrations",
});
