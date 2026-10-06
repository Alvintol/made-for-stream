export type StripeConnectAccountSessionInput = {
  country: string;
  defaultCurrency: string;
};

export type StripeConnectAccountSessionResponse = {
  account: {
    stripeAccountId: string;
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
    detailsSubmitted: boolean;
    country: string | null;
    defaultCurrency: string | null;
  };
  accountSession: {
    clientSecret: string;
    expiresAt: number;
  };
};

const getApiBase = (): string =>
  (import.meta.env.VITE_API_BASE as string | undefined)?.trim() || "";

export const getStripeConnectAccountSessionFallbackError = (
  status: number,
): string => `Stripe Connect setup failed (${status})`;

export const getNonJsonApiResponseMessage = ({
  status,
  body,
}: {
  status: number;
  body: string;
}): string => {
  const preview = body.trim().slice(0, 180);

  if (!preview) {
    return getStripeConnectAccountSessionFallbackError(status);
  }

  return `Stripe Connect setup returned a non-JSON response (${status}): ${preview}`;
};

const parseStripeConnectAccountSessionResponse = async (
  response: Response,
): Promise<StripeConnectAccountSessionResponse> => {
  const body = await response.text();

  let json: StripeConnectAccountSessionResponse & { error?: string };

  try {
    json = JSON.parse(body) as StripeConnectAccountSessionResponse & {
      error?: string;
    };
  } catch {
    throw new Error(
      getNonJsonApiResponseMessage({
        status: response.status,
        body,
      }),
    );
  }

  if (!response.ok) {
    throw new Error(
      json.error || getStripeConnectAccountSessionFallbackError(response.status),
    );
  }

  if (!json.accountSession?.clientSecret) {
    throw new Error("Stripe Connect setup did not return a client secret.");
  }

  return json;
};

export const createStripeConnectAccountSession = async ({
  token,
  country,
  defaultCurrency,
}: StripeConnectAccountSessionInput & {
  token: string;
}): Promise<StripeConnectAccountSessionResponse> => {
  const apiBase = getApiBase();

  if (!apiBase) {
    throw new Error("VITE_API_BASE is not configured.");
  }

  const response = await fetch(`${apiBase}/api/stripe/connect/account-session`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      country,
      defaultCurrency,
    }),
  });

  return parseStripeConnectAccountSessionResponse(response);
};
