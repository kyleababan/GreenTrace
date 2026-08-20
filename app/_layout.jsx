import { Slot } from "expo-router";
import AuthGuard from "./guards/AuthGuard";

export default function RootLayout() {
  return (
    <AuthGuard>
      <Slot />
    </AuthGuard>
  );
}
