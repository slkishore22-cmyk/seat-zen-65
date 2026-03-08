import { ReactNode, useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function RequireUserSession({ children }: { children: ReactNode }) {
  const navigate = useNavigate();

  useEffect(() => {
    const session = localStorage.getItem("user_session");
    if (!session) {
      navigate("/login", { replace: true });
    }
  }, [navigate]);

  const session = localStorage.getItem("user_session");
  if (!session) return null;

  return <>{children}</>;
}
