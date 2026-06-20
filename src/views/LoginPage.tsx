import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { getApiErrorMessage, login, loginWithOtp, requestOtp, type OtpRequestResponse } from "../api/auth";
import { useAuthStore } from "../store/auth-store";

type LoginMode = "password" | "otp";

type LoginFormValues = {
  username: string;
  password: string;
  otp: string;
};

export function LoginPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((state) => state.setSession);
  const [loginMode, setLoginMode] = useState<LoginMode>("password");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [otpChallenge, setOtpChallenge] = useState<OtpRequestResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOtpRequesting, setIsOtpRequesting] = useState(false);

  const { getValues, register, handleSubmit, setValue } = useForm<LoginFormValues>({
    defaultValues: {
      username: "admin",
      password: "ChangeMe123",
      otp: ""
    }
  });

  const onSubmit = handleSubmit(async (values) => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const session =
        loginMode === "password"
          ? await login({ username: values.username, password: values.password })
          : await loginWithOtp({ username: values.username, otp: values.otp });
      setSession(session);
      navigate("/", { replace: true });
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  });

  const onRequestOtp = async () => {
    setIsOtpRequesting(true);
    setErrorMessage(null);
    setOtpChallenge(null);
    setValue("otp", "");

    try {
      const challenge = await requestOtp({ username: getValues("username") });
      setOtpChallenge(challenge);
      setValue("otp", challenge.devOtp);
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error));
    } finally {
      setIsOtpRequesting(false);
    }
  };

  return (
    <div className="crm-page crm-login-layout">
      <div className="crm-login-card">
        <p className="crm-eyebrow">Asquare CRM</p>
        <h1 className="crm-title">Sign in</h1>
        <p className="crm-subtitle">
          Property sales CRM for leads, opportunities, reservations, collections follow-up, and customer lifecycle operations.
        </p>

        <div className="crm-auth-toggle">
          <button
            className={`crm-toggle-button${loginMode === "password" ? " is-active" : ""}`}
            onClick={() => {
              setLoginMode("password");
              setErrorMessage(null);
            }}
            type="button"
          >
            Password Login
          </button>
          <button
            className={`crm-toggle-button${loginMode === "otp" ? " is-active" : ""}`}
            onClick={() => {
              setLoginMode("otp");
              setErrorMessage(null);
            }}
            type="button"
          >
            OTP Login
          </button>
        </div>

        <form className="crm-form" onSubmit={onSubmit}>
          <div className="crm-field">
            <label className="crm-label" htmlFor="username">
              Email / Username
            </label>
            <input className="crm-input" id="username" {...register("username")} />
          </div>

          {loginMode === "password" ? (
            <div className="crm-field">
              <label className="crm-label" htmlFor="password">
                Password
              </label>
              <div className="crm-input-row">
                <input
                  className="crm-input"
                  id="password"
                  type={isPasswordVisible ? "text" : "password"}
                  {...register("password")}
                />
                <button
                  className="crm-inline-action"
                  onClick={() => setIsPasswordVisible((value) => !value)}
                  type="button"
                >
                  {isPasswordVisible ? "Hide" : "Show"}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="crm-field">
                <label className="crm-label" htmlFor="otp">
                  OTP
                </label>
                <div className="crm-input-row">
                  <input className="crm-input" id="otp" inputMode="numeric" maxLength={6} {...register("otp")} />
                  <button
                    className="crm-inline-action"
                    disabled={isOtpRequesting}
                    onClick={onRequestOtp}
                    type="button"
                  >
                    {isOtpRequesting ? "Generating..." : "Generate"}
                  </button>
                </div>
              </div>

              {otpChallenge ? (
                <div className="crm-otp-banner">
                  <span>Test OTP</span>
                  <strong>{otpChallenge.devOtp}</strong>
                  <small>Expires {new Date(otpChallenge.expiresAt).toLocaleTimeString()}</small>
                </div>
              ) : null}
            </>
          )}

          {errorMessage ? <div className="crm-error-banner">{errorMessage}</div> : null}

          <button className="crm-primary-button" disabled={isSubmitting} type="submit">
            {isSubmitting ? "Signing in..." : loginMode === "password" ? "Login" : "Login with OTP"}
          </button>
        </form>
      </div>
    </div>
  );
}
