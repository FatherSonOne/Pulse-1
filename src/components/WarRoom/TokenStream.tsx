import React from 'react';

interface Token {
  text: string;
  confidence: number;
  alternatives?: string[];
  timestamp: number;
}

interface TokenStreamProps {
  tokens: Token[];
  isStreaming: boolean;
  showConfidence?: boolean;
  showAlternatives?: boolean;
}

export const TokenStream: React.FC<TokenStreamProps> = ({
  tokens,
  isStreaming,
  showConfidence = true,
  showAlternatives = false
}) => {
  return (
    <div className="font-mono text-sm space-y-1">
      {tokens.map((token, index) => (
        <span
          key={index}
          className="inline-block mr-1 group relative"
        >
          <span
            className={`px-1 rounded ${
              token.confidence > 0.9
                ? 'bg-green-500/20 text-green-300'
                : token.confidence > 0.7
                ? 'bg-yellow-500/20 text-yellow-300'
                : 'bg-red-500/20 text-red-300'
            }`}
          >
            {token.text}
          </span>
          
          {showConfidence && (
            <span className="text-xs text-gray-500 ml-1">
              [{token.confidence.toFixed(2)}]
            </span>
          )}

          {showAlternatives && token.alternatives && token.alternatives.length > 0 && (
            <div className="hidden group-hover:block absolute bottom-full left-0 mb-1 p-2 bg-gray-900 border border-rose-500/30 rounded shadow-lg z-10 whitespace-nowrap">
              <div className="text-xs text-gray-400 mb-1">Alternatives:</div>
              {token.alternatives.map((alt, i) => (
                <div key={i} className="text-xs text-gray-300">{alt}</div>
              ))}
            </div>
          )}
        </span>
      ))}
      
      {isStreaming && (
        <span className="inline-block w-2 h-4 bg-rose-500 animate-pulse ml-1"></span>
      )}
    </div>
  );
};
