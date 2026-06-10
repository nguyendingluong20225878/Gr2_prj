import { SuggestionType, SentimentType } from '../types';

export function suggestionLabel(s: SuggestionType) {
  switch (s) {
    case 'buy':
      return 'Buy';
    case 'sell':
      return 'Sell';
    case 'hold':
      return 'Hold';
    case 'stake':
      return 'Stake';
    case 'close_position':
      return 'Close Position';
  }
}

export function suggestionColor(s: SuggestionType) {
  switch (s) {
    case 'buy':
      return 'green';
    case 'sell':
      return 'red';
    case 'hold':
      return 'gray';
    case 'stake':
      return 'blue';
    case 'close_position':
      return 'red';
  }
}

export function sentimentLabel(s: SentimentType) {
  switch (s) {
    case 'positive':
      return 'Positive';
    case 'negative':
      return 'Negative';
    case 'neutral':
      return 'Neutral';
  }
}

export function sentimentColor(s: SentimentType) {
  switch (s) {
    case 'positive':
      return 'green';
    case 'negative':
      return 'red';
    case 'neutral':
      return 'gray';
  }
}
