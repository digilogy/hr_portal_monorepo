"use client";

import React, { Suspense, useEffect, useState } from "react";
import { Form, Input, Button, Typography, message, Select, Checkbox } from "antd";
import { CheckCircleOutlined } from "@ant-design/icons";
import { useRouter, useSearchParams } from "next/navigation";
import { API_BASE } from "@/lib/api";
import {
  clearRememberedLogin,
  getRememberedLogin,
  isAuthenticated,
  setRememberedLogin,
} from "@/lib/auth";

const { Title, Text } = Typography;
const { Option } = Select;

const ALLOWED_DOMAINS = [
  "@casagrand.co.in",
  "@casagrandcontracts.com",
  "@digilogy.co",
  "@casagrandtravelogy.co.in",
];

type PinFlowType = "new" | "reset";
type PendingAction = "continue" | "forgot-pin" | "login" | "setup-pin" | null;

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenFromUrl = searchParams.get("token");
  const [messageApi, contextHolder] = message.useMessage();

  const [step, setStep] = useState<number>(0);
  const [emailPrefix, setEmailPrefix] = useState<string>("");
  const [emailDomain, setEmailDomain] = useState<string>(ALLOWED_DOMAINS[0]);
  const [verifiedEmail, setVerifiedEmail] = useState<string>("");
  const [mockToken, setMockToken] = useState<string>("");
  const [pinFlowType, setPinFlowType] = useState<PinFlowType>("new");
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [rememberMe, setRememberMe] = useState<boolean>(true);
  const [verifyingToken, setVerifyingToken] = useState<boolean>(!!tokenFromUrl);

  const getFullEmail = () => `${emailPrefix}${emailDomain}`;

  const persistRememberMe = () => {
    if (rememberMe && emailPrefix.trim()) {
      setRememberedLogin({
        emailPrefix: emailPrefix.trim(),
        emailDomain,
      });
      return;
    }
    clearRememberedLogin();
  };

  const applyEmailToForm = (email: string) => {
    const atIndex = email.indexOf("@");
    if (atIndex === -1) return;

    const prefix = email.slice(0, atIndex);
    const domain = email.slice(atIndex);
    setEmailPrefix(prefix);
    if (ALLOWED_DOMAINS.includes(domain)) {
      setEmailDomain(domain);
    }
    setVerifiedEmail(email);
  };

  const verifyTokenAndOpenPinSetup = async (token: string) => {
    setVerifyingToken(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/auth/verify-token?token=${encodeURIComponent(token)}`,
      );
      const data = await res.json();

      if (!res.ok) {
        messageApi.error(data.message || "Invalid or expired link.");
        router.replace("/login");
        return;
      }

      applyEmailToForm(data.email);
      setMockToken(token);
      setPinFlowType(data.isReset ? "reset" : "new");
      setStep(2);
      // Strip the one-time token from the URL so logout/history cannot reopen this screen.
      window.history.replaceState(null, "", "/login");
    } catch {
      messageApi.error("Unable to verify link. Please try again.");
      router.replace("/login");
    } finally {
      setVerifyingToken(false);
    }
  };

  useEffect(() => {
    if (tokenFromUrl) return;

    const remembered = getRememberedLogin();
    if (remembered) {
      setEmailPrefix(remembered.emailPrefix);
      setEmailDomain(remembered.emailDomain);
      setRememberMe(true);
    }
  }, [tokenFromUrl]);

  useEffect(() => {
    if (isAuthenticated()) {
      router.replace("/profile");
      return;
    }
    if (tokenFromUrl) {
      verifyTokenAndOpenPinSetup(tokenFromUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenFromUrl, router]);

  const handleRequestAccess = async () => {
    if (!emailPrefix) {
      messageApi.error("Please enter your email prefix.");
      return;
    }

    setPendingAction("continue");
    persistRememberMe();
    try {
      const res = await fetch(`${API_BASE}/api/auth/request-access`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: getFullEmail() }),
      });
      const data = await res.json();

      if (!res.ok) {
        messageApi.warning(data.message || "Unable to continue with this email.");
        return;
      }

      if (data.isNewUser) {
        setMockToken(data.mockToken);
        setPinFlowType("new");
        setStep(3);
      } else {
        setStep(1);
      }
    } catch {
      messageApi.error("Network error.");
    } finally {
      setPendingAction(null);
    }
  };

  const handleForgotPin = async () => {
    if (!emailPrefix) {
      messageApi.error("Please enter your email first.");
      return;
    }
    setPendingAction("forgot-pin");
    try {
      const res = await fetch(`${API_BASE}/api/auth/forgot-pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: getFullEmail() }),
      });
      const data = await res.json();

      if (!res.ok) {
        messageApi.warning(data.message || "Unable to send reset link.");
        return;
      }
      setMockToken(data.mockToken);
      setPinFlowType("reset");
      setStep(3);
    } catch {
      messageApi.error("Network error.");
    } finally {
      setPendingAction(null);
    }
  };

  const handleLogin = async (values: { pin: string }) => {
    setPendingAction("login");
    persistRememberMe();
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: getFullEmail(), pin: values.pin }),
      });
      const data = await res.json();

      if (!res.ok) {
        messageApi.warning(data.message || "Invalid PIN or email not registered.");
        return;
      }

      localStorage.setItem("token", data.token);
      messageApi.success("Login successful!");
      router.replace("/profile");
    } catch {
      messageApi.error("Network error");
    } finally {
      setPendingAction(null);
    }
  };

  const handleSetupPin = async (values: { pin: string; confirmPin: string }) => {
    if (values.pin !== values.confirmPin) {
      messageApi.error("PINs do not match.");
      return;
    }

    setPendingAction("setup-pin");
    try {
      const res = await fetch(`${API_BASE}/api/auth/setup-pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: mockToken, pin: values.pin }),
      });
      const data = await res.json();

      if (!res.ok) {
        messageApi.error(data.message || "Failed to set PIN");
        return;
      }

      localStorage.setItem("token", data.token);
      messageApi.success(
        pinFlowType === "reset" ? "PIN reset successfully!" : "PIN set successfully!",
      );
      router.replace("/profile");
    } catch {
      messageApi.error("Network error");
    } finally {
      setPendingAction(null);
    }
  };

  const pinValidationRules = [
    { required: true, message: "Please enter your PIN!" },
    { pattern: /^\d{4}$/, message: "PIN must be exactly 4 digits." },
  ];

  const stepTitle =
    step === 0
      ? "Sign in"
      : step === 1
        ? "Enter your PIN"
        : pinFlowType === "reset"
          ? "Reset your PIN"
          : "Create your PIN";

  const stepSubtitle =
    step === 0
      ? "Use your company email to continue"
      : step === 1
        ? "Enter the 4-digit PIN for your account"
        : pinFlowType === "reset"
          ? "Choose a new 4-digit PIN and confirm it"
          : "Choose a secure 4-digit PIN and confirm it";

  if (verifyingToken) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f4f6f9] px-4">
        <div className="rounded-2xl border border-white/80 bg-white/95 px-8 py-10 text-center shadow-[0_8px_40px_rgba(15,23,42,0.08)]">
          <Text className="text-gray-500">Verifying your secure link...</Text>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f4f6f9] px-4 py-10">
      {contextHolder}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(37,99,235,0.12),transparent)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-blue-500/5 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-indigo-500/5 blur-3xl"
      />

      <div className="relative w-full max-w-[520px] animate-fade-in">
        <div className="rounded-2xl border border-white/80 bg-white/95 px-8 py-10 shadow-[0_8px_40px_rgba(15,23,42,0.08)] backdrop-blur-sm">
          {step !== 3 && (
            <div className="mb-8 text-center">
              <div className="mx-auto mb-5 flex h-12 items-center justify-center">
                <img
                  src="/assets/Casagrand-Logo1.png"
                  alt="Casagrand Logo"
                  className="h-10 max-w-[220px] object-contain"
                />
              </div>
              <Title level={3} className="!mb-1.5 !text-xl !font-semibold !text-[#0b1e36]">
                {stepTitle}
              </Title>
              <Text className="text-sm text-gray-500">{stepSubtitle}</Text>
            </div>
          )}

          {step === 0 && (
            <div className="animate-fade-in">
              <div className="mb-5">
                <Text className="mb-2 block text-sm font-medium text-gray-700">
                  Company Email
                </Text>
                <div className="login-email-row flex w-full items-stretch rounded-lg border border-gray-200 hover:border-blue-400 focus-within:border-blue-500 focus-within:shadow-[0_0_0_3px_rgba(37,99,235,0.1)] overflow-hidden">
                  <Input
                    size="large"
                    value={emailPrefix}
                    onChange={(e) => setEmailPrefix(e.target.value)}
                    className="login-email-prefix h-12 min-w-0 flex-1 rounded-none border-0 shadow-none"
                    onPressEnter={handleRequestAccess}
                  />
                  <Select
                    value={emailDomain}
                    onChange={setEmailDomain}
                    size="large"
                    className="login-domain-select h-12 shrink-0 text-[11px]"
                    style={{ width: 236 }}
                    variant="borderless"
                    popupMatchSelectWidth={false}
                    listHeight={256}
                    styles={{
                      popup: {
                        root: {
                          minWidth: 236,
                        },
                      },
                    }}
                  >
                    {ALLOWED_DOMAINS.map((domain) => (
                      <Option key={domain} value={domain}>
                        {domain}
                      </Option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="mb-6 flex items-center justify-between">
                <Checkbox
                  checked={rememberMe}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setRememberMe(checked);
                    if (!checked) clearRememberedLogin();
                  }}
                  className="text-gray-600"
                >
                  Remember me
                </Checkbox>
                <Button
                  type="link"
                  onClick={handleForgotPin}
                  className="h-auto p-0 font-medium text-blue-600"
                  loading={pendingAction === "forgot-pin"}
                  disabled={pendingAction === "continue"}
                >
                  Forgot PIN?
                </Button>
              </div>

              <Button
                type="primary"
                onClick={handleRequestAccess}
                loading={pendingAction === "continue"}
                disabled={pendingAction === "forgot-pin"}
                className="h-11 w-full rounded-lg border-0 bg-[#2563eb] text-[15px] font-semibold shadow-[0_4px_14px_rgba(37,99,235,0.35)] hover:bg-blue-600"
              >
                Continue
              </Button>
            </div>
          )}

          {step === 1 && (
            <Form
              onFinish={handleLogin}
              size="large"
              layout="vertical"
              className="animate-fade-in"
              requiredMark={false}
            >
              <div className="mb-5 text-center">
                <Text className="inline-block rounded-full border border-gray-100 bg-gray-50 px-4 py-1.5 text-sm font-medium text-gray-600">
                  {getFullEmail()}
                </Text>
              </div>

              <Form.Item
                label={<span className="text-sm font-medium text-gray-700">PIN</span>}
                name="pin"
                rules={[{ required: true, message: "Please input your PIN!" }]}
                className="mb-5"
              >
                <Input.Password
                  className="h-12 rounded-lg"
                  placeholder="4-digit PIN"
                  maxLength={4}
                />
              </Form.Item>

              <Button
                type="primary"
                htmlType="submit"
                loading={pendingAction === "login"}
                className="h-11 w-full rounded-lg border-0 bg-[#2563eb] text-[15px] font-semibold shadow-[0_4px_14px_rgba(37,99,235,0.35)] hover:bg-blue-600"
              >
                Log In
              </Button>

              <div className="mt-5 text-center">
                <Button type="link" onClick={() => setStep(0)} className="text-gray-500">
                  Back
                </Button>
              </div>
            </Form>
          )}

          {step === 2 && (
            <Form
              onFinish={handleSetupPin}
              size="large"
              layout="vertical"
              className="animate-fade-in"
              requiredMark={false}
            >
              <div className="mb-5 text-center">
                <Text className="inline-block rounded-full border border-gray-100 bg-gray-50 px-4 py-1.5 text-sm font-medium text-gray-600">
                  {verifiedEmail || getFullEmail()}
                </Text>
              </div>

              <Form.Item
                label={
                  <span className="text-sm font-medium text-gray-700">
                    {pinFlowType === "reset" ? "New PIN" : "PIN"}
                  </span>
                }
                name="pin"
                rules={pinValidationRules}
                className="mb-4"
              >
                <Input.Password
                  className="h-12 rounded-lg"
                  placeholder="4-digit PIN"
                  maxLength={4}
                  inputMode="numeric"
                />
              </Form.Item>

              <Form.Item
                label={<span className="text-sm font-medium text-gray-700">Confirm PIN</span>}
                name="confirmPin"
                dependencies={["pin"]}
                rules={[
                  { required: true, message: "Please confirm your PIN!" },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue("pin") === value) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error("PINs do not match."));
                    },
                  }),
                ]}
                className="mb-5"
              >
                <Input.Password
                  className="h-12 rounded-lg"
                  placeholder="Re-enter 4-digit PIN"
                  maxLength={4}
                  inputMode="numeric"
                />
              </Form.Item>

              <Button
                type="primary"
                htmlType="submit"
                loading={pendingAction === "setup-pin"}
                className="h-11 w-full rounded-lg border-0 bg-emerald-600 text-[15px] font-semibold shadow-[0_4px_14px_rgba(5,150,105,0.35)] hover:bg-emerald-700"
              >
                {pinFlowType === "reset" ? "Reset PIN & Log In" : "Save PIN & Log In"}
              </Button>

              <div className="mt-5 text-center">
                <Button
                  type="link"
                  onClick={() => {
                    setStep(0);
                    router.replace("/login");
                  }}
                  className="text-gray-500"
                >
                  Back to sign in
                </Button>
              </div>
            </Form>
          )}

          {step === 3 && (
            <div className="animate-fade-in text-center">
              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50">
                <CheckCircleOutlined className="text-2xl text-blue-600" />
              </div>

              <Title level={4} className="!mb-3 !font-semibold !text-gray-800">
                Check your email
              </Title>
              <Text className="mb-7 block text-sm leading-relaxed text-gray-500">
                We sent a secure link to{" "}
                <span className="font-medium text-gray-700">{getFullEmail()}</span>. Click the
                link to {pinFlowType === "reset" ? "reset your PIN" : "set up your PIN"} and sign
                in.
              </Text>

              <Button
                type="link"
                onClick={() => setStep(0)}
                className="text-gray-500"
              >
                Back to sign in
              </Button>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">© 2026 Timesheet Portal</p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#f4f6f9]">
          <p className="text-gray-500">Loading...</p>
        </div>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}
