const MAX_LENGTH = 1000;

export function sanitizeInput(rawInput) {
  if (!rawInput || typeof rawInput !== 'string') {
    return '';
  }

  let input = rawInput.trim();

  //Limit length
  if (input.length > MAX_LENGTH) {
    input = input.substring(0, MAX_LENGTH);
  }

  //Remove script tags
  input = input.replace(/<script.*?>.*?<\/script>/gi, '[removed script]');
  
  //Remove all other HTML tags
  input = input.replace(/<\/?[^>]+(>|$)/g, '');

  //Filter out common prompt injection attempts
  const promptInjectionPatterns = [
    /ignore previous instructions/gi,
    /you are now/gi,
    /system role/gi,
    /pretend to be/gi,
    /disregard the previous/gi,
    /as an ai language model/gi
  ];

  for (const pattern of promptInjectionPatterns) {
    input = input.replace(pattern, '[filtered]');
  }

  //Replace unusual control characters (except newlines)
  input = input.replace(/[\x00-\x09\x0B-\x1F\x7F]/g, '');

  return input;
}

export default sanitizeInput;