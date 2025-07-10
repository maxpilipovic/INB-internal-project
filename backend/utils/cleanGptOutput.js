export function cleanGptOutput(text) {
  if (!text) return '';

  return text
    .replace(/```[\s\S]*?```/g, '') // Remove code blocks
    .replace(/^Certainly!?[\s\S]*?(subject|description)?[:\-–—]*/i, '') // Remove GPT preamble
    .replace(/^\s*(\*\*|__)?(subject|description|priority)(\*\*|__)?[:\-–—]*/gi, '') // Remove leading markdown/labels
    .replace(/\*\*(subject|description|priority)\*\*[:\-–—]?/gi, '') // Remove inline **label:** anywhere
    .replace(/(subject|description|priority)[:\-–—]/gi, '') // Remove plain label anywhere
    .replace(/---.*?---/gs, '') // Remove markdown dividers
    .replace(/^[-–—\s]+/, '') // Remove leading dashes/spaces
    .trim();
}