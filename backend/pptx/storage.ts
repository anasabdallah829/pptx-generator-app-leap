import { Bucket } from "encore.dev/storage/objects";

export const templatesBucket = new Bucket("templates");
export const imagesBucket = new Bucket("images", { public: true });
export const outputBucket = new Bucket("output", { public: true });
