import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { getApiErrorMessage, login } from "../api/auth";
import { useAuthStore } from "../store/auth-store";

type LoginFormValues = {
  username: string;
  password: string;
};

export function LoginPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((state) => state.setSession);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit } = useForm<LoginFormValues>({
    defaultValues: {
      username: "admin",
      password: "ChangeMe123"
    }
  });

  const onSubmit = handleSubmit(async (values) => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const session = await login(values);
      setSession(session);
      navigate("/", { replace: true });
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  });

  return (
    <div className="crm-page crm-login-layout">
      <div className="crm-login-card">
        <p className="crm-eyebrow">Asquare CRM</p>
        <h1 className="crm-title">Sign in</h1>
        <p className="crm-subtitle">
          Property sales CRM for leads, opportunities, reservations, collections follow-up, and customer lifecycle operations.
        </p>

        <div className="crm-auth-toggle">
          <button className="crm-toggle-button is-active" type="button">
            Password Login
          </button>
          <button className="crm-toggle-button" type="button">
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

          {errorMessage ? <div className="crm-error-banner">{errorMessage}</div> : null}

          <button className="crm-primary-button" disabled={isSubmitting} type="submit">
            {isSubmitting ? "Signing in..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
}
