declare module "../firebase" {
  import { Firestore } from "firebase/firestore";
  import { Analytics } from "firebase/analytics";

  export const db: Firestore;
  export const analytics: Analytics;
}
