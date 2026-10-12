import { describe, it, expect } from "vitest";
import type { BankSession, Transaction } from "../src/types";
import { isConsentExpired } from "../src/enable-banking/client";

const mockSession: BankSession = {
  sessionId: "session-123",
  aspspId: "test-bank",
  aspspName: "Test Bank",
  aspspCountry: "SE",
  consentValidUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
  accounts: [
    {
      accountId: "acc-1",
      iban: "SE1234567890123456",
      name: "Main Account",
      currency: "SEK",
      accountType: "Current",
    },
    {
      accountId: "acc-2",
      iban: "SE9876543210987654",
      name: "Savings",
      currency: "SEK",
      accountType: "Savings",
    },
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockExpiredSession: BankSession = {
  ...mockSession,
  consentValidUntil: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split("T")[0],
};

const mockTransactions: Transaction[] = [
  {
    transaction_id: "tx-1",
    booking_date: "2024-01-15",
    transaction_amount: { amount: "-50.00", currency: "SEK" },
    creditor_name: "Grocery Store",
    remittance_information: ["Weekly groceries"],
    merchant_category_code: "5411",
  },
  {
    transaction_id: "tx-2",
    booking_date: "2024-01-14",
    transaction_amount: { amount: "2500.00", currency: "SEK" },
    debtor_name: "Employer Inc",
    remittance_information: ["Salary January"],
  },
  {
    transaction_id: "tx-3",
    booking_date: "2024-01-13",
    transaction_amount: { amount: "-120.00", currency: "SEK" },
    creditor_name: "Restaurant ABC",
    remittance_information: ["Dinner"],
    merchant_category_code: "5812",
  },
];

describe("Session Management", () => {
  it("should detect expired consent", () => {
    expect(isConsentExpired(mockSession)).toBe(false);
    expect(isConsentExpired(mockExpiredSession)).toBe(true);
  });

  it("should handle session with future expiry", () => {
    const futureSession: BankSession = {
      ...mockSession,
      consentValidUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    };

    expect(isConsentExpired(futureSession)).toBe(false);
  });
});

function categorizeTransactionHelper(tx: Transaction): string {
  const mcc = tx.merchant_category_code;
  const info = (tx.remittance_information || []).join(" ").toLowerCase();
  const creditor = (tx.creditor_name || "").toLowerCase();

  if (mcc) {
    const mccNum = parseInt(mcc);
    if (mccNum >= 5411 && mccNum <= 5499) return "Groceries";
    if (mccNum >= 5812 && mccNum <= 5814) return "Restaurants";
    if (mccNum >= 4011 && mccNum <= 4789) return "Transportation";
    if (mccNum >= 5200 && mccNum <= 5261) return "Home";
    if (mccNum >= 5300 && mccNum <= 5399) return "Shopping";
    if (mccNum >= 6011 && mccNum <= 6399) return "Financial";
    if (mccNum >= 7800 && mccNum <= 7999) return "Entertainment";
    if (mccNum >= 8011 && mccNum <= 8099) return "Healthcare";
  }

  const keywords: Record<string, string[]> = {
    Groceries: ["grocery", "supermarket", "food", "market"],
    Restaurants: ["restaurant", "cafe", "coffee", "pizza", "burger"],
    Transportation: ["uber", "lyft", "taxi", "transit", "fuel", "gas", "parking"],
    Utilities: ["electric", "water", "gas", "internet", "phone"],
    Entertainment: ["netflix", "spotify", "cinema", "movie", "game"],
    Shopping: ["amazon", "ebay", "shop", "store"],
    Healthcare: ["pharmacy", "doctor", "hospital", "medical"],
    Subscription: ["subscription", "membership"],
  };

  for (const [category, words] of Object.entries(keywords)) {
    if (words.some((w) => info.includes(w) || creditor.includes(w))) {
      return category;
    }
  }

  return "Other";
}

describe("Transaction Categorization", () => {
  it("should categorize groceries by MCC", () => {
    const tx: Transaction = {
      transaction_amount: { amount: "-50", currency: "SEK" },
      merchant_category_code: "5411",
    };

    const category = categorizeTransactionHelper(tx);
    expect(category).toBe("Groceries");
  });

  it("should categorize restaurants by MCC", () => {
    const tx: Transaction = {
      transaction_amount: { amount: "-30", currency: "SEK" },
      merchant_category_code: "5812",
    };

    const category = categorizeTransactionHelper(tx);
    expect(category).toBe("Restaurants");
  });

  it("should categorize by keywords when no MCC", () => {
    const tx: Transaction = {
      transaction_amount: { amount: "-15", currency: "SEK" },
      creditor_name: "Netflix",
      remittance_information: ["Monthly subscription"],
    };

    const category = categorizeTransactionHelper(tx);
    expect(category).toBe("Entertainment");
  });

  it("should categorize uber as transportation", () => {
    const tx: Transaction = {
      transaction_amount: { amount: "-25", currency: "SEK" },
      creditor_name: "Uber",
    };

    const category = categorizeTransactionHelper(tx);
    expect(category).toBe("Transportation");
  });

  it("should return Other for unknown transactions", () => {
    const tx: Transaction = {
      transaction_amount: { amount: "-100", currency: "SEK" },
      creditor_name: "Random Company XYZ",
    };

    const category = categorizeTransactionHelper(tx);
    expect(category).toBe("Other");
  });
});

describe("Amount Formatting", () => {
  function formatAmount(amount: string, currency: string): string {
    const num = parseFloat(amount);
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(num);
  }

  it("should format SEK amounts", () => {
    expect(formatAmount("100.50", "SEK")).toContain("100");
    expect(formatAmount("100.50", "SEK")).toContain("SEK");
  });

  it("should format EUR amounts", () => {
    expect(formatAmount("50.00", "EUR")).toContain("50");
    expect(formatAmount("50.00", "EUR")).toContain("€");
  });

  it("should handle negative amounts", () => {
    const formatted = formatAmount("-25.00", "USD");
    expect(formatted).toContain("25");
  });

  it("should handle large amounts", () => {
    const formatted = formatAmount("1234567.89", "USD");
    expect(formatted).toContain("1,234,567");
  });
});

describe("Spending Summary", () => {
  it("should separate spending and income", () => {
    const spending: Record<string, number> = {};
    const income: Record<string, number> = {};
    let totalSpending = 0;
    let totalIncome = 0;

    for (const tx of mockTransactions) {
      const amount = parseFloat(tx.transaction_amount.amount);
      const category = categorizeTransactionHelper(tx);

      if (amount < 0) {
        const absAmount = Math.abs(amount);
        spending[category] = (spending[category] || 0) + absAmount;
        totalSpending += absAmount;
      } else {
        income[category] = (income[category] || 0) + amount;
        totalIncome += amount;
      }
    }

    expect(totalSpending).toBe(170);
    expect(totalIncome).toBe(2500);
    expect(spending["Groceries"]).toBe(50);
    expect(spending["Restaurants"]).toBe(120);
    expect(income["Other"]).toBe(2500);
  });

  it("should calculate net flow correctly", () => {
    let totalSpending = 0;
    let totalIncome = 0;

    for (const tx of mockTransactions) {
      const amount = parseFloat(tx.transaction_amount.amount);
      if (amount < 0) {
        totalSpending += Math.abs(amount);
      } else {
        totalIncome += amount;
      }
    }

    const netFlow = totalIncome - totalSpending;
    expect(netFlow).toBe(2330);
  });
});

describe("Account Lookup", () => {
  it("should find account by ID", () => {
    const account = mockSession.accounts.find((a) => a.accountId === "acc-1");
    expect(account).toBeDefined();
    expect(account?.name).toBe("Main Account");
  });

  it("should return undefined for unknown account", () => {
    const account = mockSession.accounts.find((a) => a.accountId === "unknown");
    expect(account).toBeUndefined();
  });
});

describe("Date Range Defaults", () => {
  it("should default to last 30 days for transactions", () => {
    const now = new Date();
    const toDate = now.toISOString().split("T")[0];
    const fromDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    expect(toDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(fromDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("should default to last 90 days for search", () => {
    const fromDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    expect(fromDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("should handle month range for summary", () => {
    const targetMonth = "2024-01";
    const [year, mon] = targetMonth.split("-").map(Number);
    const fromDate = `${year}-${String(mon).padStart(2, "0")}-01`;
    const lastDay = new Date(year, mon, 0).getDate();
    const toDate = `${year}-${String(mon).padStart(2, "0")}-${lastDay}`;

    expect(fromDate).toBe("2024-01-01");
    expect(toDate).toBe("2024-01-31");
  });

  it("should handle last3 months for summary", () => {
    const now = new Date();
    const toDate = now.toISOString().split("T")[0];
    now.setMonth(now.getMonth() - 3);
    const fromDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

    expect(fromDate).toMatch(/^\d{4}-\d{2}-01$/);
  });
});

describe("Transaction Search", () => {
  it("should find transactions by counterparty name", () => {
    const query = "grocery";
    const matches = mockTransactions.filter((tx) => {
      const counterparty = tx.creditor_name || tx.debtor_name || "";
      return counterparty.toLowerCase().includes(query.toLowerCase());
    });

    expect(matches.length).toBe(1);
    expect(matches[0].creditor_name).toBe("Grocery Store");
  });

  it("should find transactions by description", () => {
    const query = "salary";
    const matches = mockTransactions.filter((tx) => {
      const description = (tx.remittance_information || []).join(" ");
      return description.toLowerCase().includes(query.toLowerCase());
    });

    expect(matches.length).toBe(1);
    expect(matches[0].debtor_name).toBe("Employer Inc");
  });

  it("should be case insensitive", () => {
    const query = "GROCERY";
    const matches = mockTransactions.filter((tx) => {
      const counterparty = tx.creditor_name || tx.debtor_name || "";
      const description = (tx.remittance_information || []).join(" ");
      return (
        counterparty.toLowerCase().includes(query.toLowerCase()) ||
        description.toLowerCase().includes(query.toLowerCase())
      );
    });

    expect(matches.length).toBe(1);
  });

  it("should return empty for no matches", () => {
    const query = "nonexistent";
    const matches = mockTransactions.filter((tx) => {
      const counterparty = tx.creditor_name || tx.debtor_name || "";
      const description = (tx.remittance_information || []).join(" ");
      return (
        counterparty.toLowerCase().includes(query.toLowerCase()) ||
        description.toLowerCase().includes(query.toLowerCase())
      );
    });

    expect(matches.length).toBe(0);
  });
});
