import { GoogleGenAI } from "@google/genai";
import { Strategy } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getStrategyAnalysis = async (strategy: Strategy): Promise<string> => {
  try {
    const prompt = `
      You are a senior quantitative trading analyst. Analyze the following trading strategy performance.
      Be concise, professional, and data-driven (Robinhood style - clear and trustworthy).
      
      Strategy Name: ${strategy.name}
      Type: ${strategy.type}
      Total PnL: $${strategy.totalPnl}
      Return: ${strategy.returnPercentage}%
      Win Rate: ${strategy.winRate}%
      Max Drawdown: ${strategy.maxDrawdown}%
      Risk Level: ${strategy.riskLevel}
      
      Recent Trades: ${JSON.stringify(strategy.trades.slice(0, 5))}
      
      Provide a 2-3 sentence summary of why this strategy is performing this way and a 1 sentence recommendation.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text || "Analysis unavailable at this moment.";
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return "Unable to generate AI analysis. Please check your network connection.";
  }
};