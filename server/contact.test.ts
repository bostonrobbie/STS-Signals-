import { describe, it, expect, vi } from "vitest";
import * as db from "./db";

// Mock the notification module
vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));

// Mock the LLM module
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [
      {
        message: {
          content: "Thank you for reaching out. We will get back to you soon.",
        },
      },
    ],
  }),
}));

describe("Contact Messages Database Functions", () => {
  describe("createContactMessage", () => {
    it("should create a contact message with required fields", async () => {
      const testMessage = {
        name: "Test User",
        email: "test@example.com",
        subject: "Test Subject",
        message: "This is a test message for the contact form.",
        category: "general" as const,
      };

      const messageId = await db.createContactMessage(testMessage);

      expect(messageId).toBeDefined();
      expect(messageId).not.toBeNull();
      expect(typeof messageId).toBe("number");
    });

    it("should create a contact message with optional userId", async () => {
      const testMessage = {
        name: "Logged In User",
        email: "loggedin@example.com",
        subject: "Support Request",
        message: "I need help with my account settings.",
        category: "support" as const,
        userId: 1,
      };

      const messageId = await db.createContactMessage(testMessage);

      expect(messageId).toBeDefined();
      expect(messageId).not.toBeNull();
    });
  });

  describe("getContactMessages", () => {
    it("should retrieve contact messages with default pagination", async () => {
      const result = await db.getContactMessages({});

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it("should filter messages by status", async () => {
      const result = await db.getContactMessages({ status: "new" });

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      // All returned messages should have status "new"
      result.forEach((msg: any) => {
        expect(msg.status).toBe("new");
      });
    });

    it("should filter messages by category", async () => {
      const result = await db.getContactMessages({ category: "general" });

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      // All returned messages should have category "general"
      result.forEach((msg: any) => {
        expect(msg.category).toBe("general");
      });
    });

    it("should respect limit parameter", async () => {
      const limit = 5;
      const result = await db.getContactMessages({ limit });

      expect(result).toBeDefined();
      expect(result.length).toBeLessThanOrEqual(limit);
    });
  });

  describe("getContactMessageById", () => {
    it("should retrieve a specific message by ID", async () => {
      // First create a message
      const testMessage = {
        name: "Get By ID Test",
        email: "getbyid@example.com",
        subject: "Test Get By ID",
        message: "Testing the getContactMessageById function.",
        category: "general" as const,
      };

      const messageId = await db.createContactMessage(testMessage);
      expect(messageId).not.toBeNull();

      // Then retrieve it
      const message = await db.getContactMessageById(messageId!);

      expect(message).toBeDefined();
      expect(message?.id).toBe(messageId);
      expect(message?.name).toBe(testMessage.name);
      expect(message?.email).toBe(testMessage.email);
      expect(message?.subject).toBe(testMessage.subject);
    });

    it("should return null for non-existent ID", async () => {
      const message = await db.getContactMessageById(999999);

      expect(message).toBeNull();
    });
  });

  describe("updateContactMessage", () => {
    it("should update message status", async () => {
      // First create a message
      const testMessage = {
        name: "Update Test",
        email: "update@example.com",
        subject: "Test Update",
        message: "Testing the updateContactMessage function.",
        category: "general" as const,
      };

      const messageId = await db.createContactMessage(testMessage);
      expect(messageId).not.toBeNull();

      // Update the status
      await db.updateContactMessage(messageId!, { status: "read" });

      // Verify the update
      const updatedMessage = await db.getContactMessageById(messageId!);
      expect(updatedMessage?.status).toBe("read");
    });

    it("should update AI suggested response", async () => {
      // First create a message
      const testMessage = {
        name: "AI Response Test",
        email: "airesponse@example.com",
        subject: "Test AI Response",
        message: "Testing the AI response update.",
        category: "support" as const,
      };

      const messageId = await db.createContactMessage(testMessage);
      expect(messageId).not.toBeNull();

      const aiResponse = "This is an AI generated response.";
      await db.updateContactMessage(messageId!, {
        aiSuggestedResponse: aiResponse,
        aiResponseGeneratedAt: new Date(),
      });

      // Verify the update
      const updatedMessage = await db.getContactMessageById(messageId!);
      expect(updatedMessage?.aiSuggestedResponse).toBe(aiResponse);
      expect(updatedMessage?.aiResponseGeneratedAt).toBeDefined();
    });
  });

  describe("createContactResponse", () => {
    it("should create a response for a message", async () => {
      // First create a message
      const testMessage = {
        name: "Response Test",
        email: "response@example.com",
        subject: "Test Response Creation",
        message: "Testing the createContactResponse function.",
        category: "general" as const,
      };

      const messageId = await db.createContactMessage(testMessage);
      expect(messageId).not.toBeNull();

      // Create a response
      const responseId = await db.createContactResponse({
        messageId: messageId!,
        responseText:
          "Thank you for your message. We will get back to you soon.",
        isAiGenerated: false,
      });

      expect(responseId).toBeDefined();
      expect(responseId).not.toBeNull();
    });
  });

  describe("getContactMessageStats", () => {
    it("should return message statistics", async () => {
      const stats = await db.getContactMessageStats();

      expect(stats).toBeDefined();
      expect(typeof stats.new).toBe("number");
      expect(typeof stats.inProgress).toBe("number");
      expect(typeof stats.awaitingResponse).toBe("number");
      expect(typeof stats.resolved).toBe("number");
      expect(typeof stats.total).toBe("number");
    });
  });
});
