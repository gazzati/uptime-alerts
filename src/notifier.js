export class TelegramNotifier {
  constructor({ botToken, chatId }) {
    this.botToken = botToken;
    this.chatId = chatId;
  }

  async send(message) {
    const response = await fetch(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        chat_id: this.chatId,
        text: message,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Telegram API request failed with status ${response.status}: ${body}`);
    }
  }
}
