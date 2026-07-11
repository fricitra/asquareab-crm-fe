import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { getApiErrorMessage } from "../api/auth";
import {
  chatDashboardAi,
  getDashboardAiInsights,
  type DashboardAiChatMessage,
  type DashboardAiInsight,
  type DashboardPeriod,
  type DashboardView
} from "../api/dashboard";
import { useModalEscape } from "../hooks/useModalEscape";
import { NavIcon } from "./NavIcons";

type DashboardAiAssistantProps = {
  open: boolean;
  onClose: () => void;
  view: DashboardView;
  period: DashboardPeriod;
};

type ChatEntry = DashboardAiChatMessage & {
  id: string;
};

function InsightCard({ insight }: { insight: DashboardAiInsight }) {
  return (
    <article className="crm-dashboard-ai-insight">
      <h4>{insight.title}</h4>
      <p>{insight.summary}</p>
      <ul>
        {insight.bullets.map((bullet) => (
          <li key={bullet}>{bullet}</li>
        ))}
      </ul>
    </article>
  );
}

function ChatBubble({ message }: { message: ChatEntry }) {
  return (
    <div className={`crm-dashboard-ai-message crm-dashboard-ai-message-${message.role}`}>
      <div className="crm-dashboard-ai-message-meta">{message.role === "assistant" ? "AI Analyst" : "You"}</div>
      <div className="crm-dashboard-ai-message-body">{message.content}</div>
    </div>
  );
}

export function DashboardAiAssistant({ open, onClose, view, period }: DashboardAiAssistantProps) {
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [draft, setDraft] = useState("");
  const transcriptRef = useRef<HTMLDivElement>(null);

  useModalEscape(open, onClose);

  const insightsQuery = useQuery({
    queryKey: ["dashboard", "ai", "insights", view, period],
    queryFn: () => getDashboardAiInsights(view, period),
    enabled: open,
    staleTime: 30_000
  });

  const chatMutation = useMutation({
    mutationFn: chatDashboardAi
  });

  useEffect(() => {
    if (!open) {
      setMessages([]);
      setDraft("");
    }
  }, [open, view, period]);

  useEffect(() => {
    if (!transcriptRef.current) {
      return;
    }

    transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
  }, [messages, insightsQuery.data, chatMutation.isPending]);

  const askQuestion = async (question: string) => {
    const trimmed = question.trim();
    if (!trimmed || chatMutation.isPending) {
      return;
    }

    const history = messages.map(({ role, content }) => ({ role, content }));
    const userMessage: ChatEntry = { id: `user-${Date.now()}`, role: "user", content: trimmed };
    setMessages((current) => [...current, userMessage]);
    setDraft("");

    try {
      const response = await chatMutation.mutateAsync({
        view,
        period,
        message: trimmed,
        history
      });
      setMessages((current) => [
        ...current,
        { id: `assistant-${Date.now()}`, role: "assistant", content: response.reply }
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: `assistant-error-${Date.now()}`,
          role: "assistant",
          content: getApiErrorMessage(error)
        }
      ]);
    }
  };

  if (!open) {
    return null;
  }

  const insights = insightsQuery.data?.insights ?? [];
  const suggestedQuestions = insightsQuery.data?.suggestedQuestions ?? [];

  return (
    <div className="crm-modal-backdrop" role="presentation">
      <section aria-modal="true" className="crm-modal crm-dashboard-ai-modal" role="dialog">
        <div className="crm-panel-header">
          <div>
            <p className="crm-eyebrow">Dashboard AI</p>
            <h3>Sales Intelligence Assistant</h3>
            <p className="crm-muted-text">
              {view === "operations" ? "Sales Operations Overview" : "Sales Stage Pipeline View"} ·{" "}
              {insightsQuery.data?.periodLabel ?? "Current period"}
            </p>
          </div>
          <button className="crm-secondary-button crm-fit-button" onClick={onClose} type="button">
            Close
          </button>
        </div>

        <div className="crm-dashboard-ai-transcript" ref={transcriptRef}>
          {insightsQuery.isLoading ? <p className="crm-muted-text">Analyzing dashboard data...</p> : null}
          {insightsQuery.isError ? (
            <div className="crm-error-banner">{getApiErrorMessage(insightsQuery.error)}</div>
          ) : null}

          {!insightsQuery.isLoading && insights.length ? (
            <section className="crm-dashboard-ai-insights">
              <div className="crm-dashboard-ai-intro">
                <span className="crm-dashboard-ai-badge">
                  <NavIcon name="ai" />
                  AI Briefing
                </span>
                <p>
                  Here is a quick read on progress, priorities, buyer patterns, and practical scenarios based on your live CRM
                  data.
                </p>
              </div>
              {insights.map((insight) => (
                <InsightCard insight={insight} key={insight.category} />
              ))}
            </section>
          ) : null}

          {messages.map((message) => (
            <ChatBubble key={message.id} message={message} />
          ))}

          {chatMutation.isPending ? <p className="crm-muted-text">Thinking...</p> : null}
        </div>

        {suggestedQuestions.length ? (
          <div className="crm-dashboard-ai-suggestions">
            {suggestedQuestions.map((question) => (
              <button
                className="crm-dashboard-ai-suggestion"
                key={question}
                onClick={() => void askQuestion(question)}
                type="button"
              >
                {question}
              </button>
            ))}
          </div>
        ) : null}

        <form
          className="crm-dashboard-ai-composer"
          onSubmit={(event) => {
            event.preventDefault();
            void askQuestion(draft);
          }}
        >
          <input
            className="crm-input"
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Ask about progress, pipeline, buyers, inventory, or next actions..."
            value={draft}
          />
          <button className="crm-primary-button crm-fit-button" disabled={!draft.trim() || chatMutation.isPending} type="submit">
            Send
          </button>
        </form>
      </section>
    </div>
  );
}
