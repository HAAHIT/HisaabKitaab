"use client";

import { useState } from "react";
import {
  Card,
  CardBody,
  CardHeader,
  Input,
  Button,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Divider,
} from "@heroui/react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";

export default function LoginPage() {
  const router = useRouter();
  const { t, language, setLanguage } = useLanguage();
  const [credential, setCredential] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  const isFormValid = credential.trim() !== "" && password.trim() !== "";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || t("login.loginFailed"));
        setLoading(false);
        return;
      }

      // Role-based redirect
      if (data.user.role === "CUSTOMER") {
        router.push("/measurements/upload");
      } else {
        router.push("/dashboard");
      }
    } catch {
      setError(t("login.networkError"));
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-zinc-950 dark:via-zinc-900 dark:to-blue-950 p-4">
      {/* Background gradient orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-400/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-indigo-400/20 rounded-full blur-3xl" />
      </div>

      <Card className="w-full max-w-md animate-scale-in shadow-2xl" isBlurred>
        <CardHeader className="flex flex-col items-center gap-2 pt-8 pb-2">
          {/* Logo / Icon */}
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
            <svg
              className="w-9 h-9 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            HisaabKitaab
          </h1>
          <p className="text-sm text-default-500">
            {t("login.subtitle")}
          </p>
        </CardHeader>

        <Divider className="my-2" />

        <CardBody className="px-6 pb-8">
          <div className="mb-4 flex justify-end">
            <Button
              size="sm"
              variant="flat"
              color="primary"
              onPress={() => setLanguage(language === "en" ? "hi" : "en")}
            >
              {language === "en" ? "HI" : "EN"}
            </Button>
          </div>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              id="credential-input"
              label={t("login.credentialLabel")}
              placeholder={t("login.credentialPlaceholder")}
              type="text"
              value={credential}
              onValueChange={setCredential}
              variant="bordered"
              size="lg"
              autoComplete="username"
              startContent={
                <svg
                  className="w-5 h-5 text-default-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zm-4 7a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              }
            />

            <Input
              id="password-input"
              label={t("login.passwordLabel")}
              placeholder={t("login.passwordPlaceholder")}
              type={showPassword ? "text" : "password"}
              value={password}
              onValueChange={setPassword}
              variant="bordered"
              size="lg"
              autoComplete="current-password"
              startContent={
                <svg
                  className="w-5 h-5 text-default-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              }
              endContent={
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-default-400 hover:text-default-600 transition"
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              }
            />

            {error && (
              <p className="text-danger text-sm text-center animate-fade-in">
                {error}
              </p>
            )}

            <Button
              id="login-button"
              type="submit"
              color="primary"
              size="lg"
              className="mt-2 font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 shadow-lg shadow-blue-500/25"
              isLoading={loading}
              isDisabled={!isFormValid}
            >
              {loading ? t("login.signingIn") : t("login.signIn")}
            </Button>

            <button
              type="button"
              onClick={() => setShowForgot(true)}
              className="text-sm text-primary hover:underline text-center transition"
            >
              {t("login.forgotPassword")}
            </button>
          </form>
        </CardBody>
      </Card>

      {/* Forgot password modal */}
      <Modal isOpen={showForgot} onOpenChange={setShowForgot} placement="center">
        <ModalContent>
          <ModalHeader>{t("login.forgotPasswordTitle")}</ModalHeader>
          <ModalBody>
            <p className="text-default-600">
              {t("login.forgotPasswordBody")}
            </p>
          </ModalBody>
          <ModalFooter>
            <Button
              color="primary"
              variant="light"
              onPress={() => setShowForgot(false)}
            >
              {t("common.ok")}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
