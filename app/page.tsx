'use client';

import { useState, useEffect } from 'react';
import { saveScore, getLeaderboard } from '@/lib/firebase';
import {
  login as authLogin,
  getPlayerName,
  isPremium,
  isLoggedIn,
  getDailyTries,
  canPlay,
  logout as authLogout,
  setPremium,
  decrementTries,
} from '@/lib/auth';

interface Score {
  id: string;
  playerName: string;
  score: number;
}

const suits = ['♥', '♦', '♣', '♠'];
const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

interface Card {
  suit: string;
  value: string;
  power: number;
}

export default function CardBattle() {
  const [playerName, setPlayerName] = useState('');
  const [isLoggedInState, setIsLoggedInState] = useState(false);
  const [playerHand, setPlayerHand] = useState<Card[]>([]);
  const [opponentHand, setOpponentHand] = useState<Card[]>([]);
  const [selectedCard, setSelectedCard] = useState<number | null>(null);
  const [playerScore, setPlayerScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [round, setRound] = useState(1);
  const [showHelp, setShowHelp] = useState(false);
  const [message, setMessage] = useState('Enter your name to play');
  const [playerPlayed, setPlayerPlayed] = useState<Card | null>(null);
  const [opponentPlayed, setOpponentPlayed] = useState<Card | null>(null);
  const [leaderboard, setLeaderboard] = useState<Score[]>([]);
  const [gameOver, setGameOver] = useState(false);
  const [showWinModal, setShowWinModal] = useState(false);
  const [dailyTries, setDailyTries] = useState(5);
  const [isPremiumUser, setIsPremiumUser] = useState(false);
  const [showPaywallModal, setShowPaywallModal] = useState(false);
  const [paywallMessage, setPaywallMessage] = useState('');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('premium') === 'true') {
      setPremium(true);
      setIsPremiumUser(true);
      window.history.replaceState({}, '', window.location.pathname);
    }
    
    const name = getPlayerName();
    if (name) {
      setPlayerName(name);
      setIsLoggedInState(true);
      setDailyTries(getDailyTries());
      setIsPremiumUser(isPremium());
      loadLeaderboard();
      newGame();
    }
  }, []);

  const loadLeaderboard = async () => {
    const scores = await getLeaderboard();
    setLeaderboard(scores as Score[]);
  };

  const createDeck = (): Card[] => {
    const deck: Card[] = [];
    for (const suit of suits) {
      for (let i = 0; i < values.length; i++) {
        deck.push({ suit, value: values[i], power: i + 2 });
      }
    }
    return deck.sort(() => Math.random() - 0.5);
  };

  const dealCards = () => {
    const deck = createDeck();
    setPlayerHand(deck.slice(0, 5));
    setOpponentHand(deck.slice(5, 10));
  };

  const newGame = () => {
    if (!canPlay()) {
      setPaywallMessage('Daily limit reached! Come back tomorrow for more free games.');
      setShowPaywallModal(true);
      return;
    }

    setPlayerScore(0);
    setOpponentScore(0);
    setRound(1);
    setSelectedCard(null);
    setMessage('Select a card to play');
    setPlayerPlayed(null);
    setOpponentPlayed(null);
    setGameOver(false);
    setGameStarted(false);
    dealCards();
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (playerName.trim()) {
      authLogin(playerName.trim());
      setIsLoggedInState(true);
      setDailyTries(getDailyTries());
      setIsPremiumUser(isPremium());
    }
  };

  const selectCard = (index: number) => {
    setSelectedCard(selectedCard === index ? null : index);
  };

  const playCard = () => {
    if (selectedCard === null) {
      setMessage('Please select a card first!');
      return;
    }

    if (!gameStarted) {
      setGameStarted(true);
      decrementTries();
      setDailyTries(getDailyTries());
    }

    const playerCard = playerHand[selectedCard];
    const opponentCardIndex = Math.floor(Math.random() * opponentHand.length);
    const opponentCard = opponentHand[opponentCardIndex];

    setPlayerPlayed(playerCard);
    setOpponentPlayed(opponentCard);

    let roundMessage = '';
    if (playerCard.power > opponentCard.power) {
      setPlayerScore(prev => prev + 1);
      roundMessage = `You win! (${playerCard.value} beats ${opponentCard.value})`;
    } else if (playerCard.power < opponentCard.power) {
      setOpponentScore(prev => prev + 1);
      roundMessage = `Opponent wins! (${opponentCard.value} beats ${playerCard.value})`;
    } else {
      roundMessage = `Tie! (Both ${playerCard.value})`;
    }

    const newPlayerHand = [...playerHand];
    newPlayerHand.splice(selectedCard, 1);
    setPlayerHand(newPlayerHand);

    const newOpponentHand = [...opponentHand];
    newOpponentHand.splice(opponentCardIndex, 1);
    setOpponentHand(newOpponentHand);

    setSelectedCard(null);
    setRound(prev => prev + 1);

    if (newPlayerHand.length === 0) {
      setGameOver(true);
      const finalPlayerScore = playerCard.power > opponentCard.power ? playerScore + 1 : playerScore;
      const finalOpponentScore = playerCard.power < opponentCard.power ? opponentScore + 1 : opponentScore;
      
      if (finalPlayerScore > finalOpponentScore) {
        setMessage(`Game Over - You Win! (${finalPlayerScore}-${finalOpponentScore}) 🎉`);
        setShowWinModal(true);
        saveScore(playerName, finalPlayerScore);
      } else if (finalPlayerScore < finalOpponentScore) {
        setMessage(`Game Over - You Lose! (${finalOpponentScore}-${finalPlayerScore})`);
      } else {
        setMessage(`Game Over - Tie! (${finalPlayerScore}-${finalOpponentScore})`);
      }
      loadLeaderboard();
    } else {
      setMessage(roundMessage);
    }
  };

  const handleNewGame = () => {
    const remaining = getDailyTries();
    if (remaining <= 0) {
      setPaywallMessage('Daily limit reached! Come back tomorrow for more free games.');
      setShowPaywallModal(true);
      return;
    }
    newGame();
  };

  const handleLogout = () => {
    authLogout();
    setIsLoggedInState(false);
    setPlayerName('');
    setGameOver(false);
  };

  const handleUpgradeClick = () => {
    setShowUpgradeModal(true);
  };

  if (!isLoggedInState) {
    return (
      <div className="login-overlay">
        <div className="login-box">
          <h1>Card Battle</h1>
          <p style={{ marginBottom: '1rem', color: '#888' }}>Enter your name to play</p>
          <form onSubmit={handleLogin}>
            <input
              type="text"
              placeholder="Your name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              required
            />
            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
              Start Playing
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="game-container">
      <header>
        <div className="header-row">
          <h1>Card Battle</h1>
          <div className="header-actions">
            {!isPremiumUser && (
              <button className="btn btn-premium btn-small" onClick={handleUpgradeClick}>
                Upgrade
              </button>
            )}
            {isPremiumUser && <span className="premium-badge">Premium</span>}
            <button className="btn btn-small btn-secondary" onClick={() => setShowHelp(true)}>How to Play</button>
            <button className="btn btn-small btn-secondary" onClick={handleLogout}>Logout</button>
          </div>
        </div>
        <div className="stats">
          <div className="stat">Player: {playerName}</div>
          <div className="stat">Tries: {dailyTries}/5</div>
          <div className="stat">Your Score: {playerScore}</div>
          <div className="stat">Opponent: {opponentScore}</div>
          <div className="stat">Cards Left: {playerHand.length}</div>
        </div>
      </header>

      <div className="play-area">
        <div className="opponent-hand">
          {opponentHand.map((_, i) => (
            <div key={i} className="card face-down" />
          ))}
        </div>
        
        <div className="battlefield">
          <div className="battlefield-slot">
            {opponentPlayed ? (
              <div className="card">
                <div className="card-value">{opponentPlayed.value}</div>
                <div className="card-suit" style={{ color: opponentPlayed.suit === '♥' || opponentPlayed.suit === '♦' ? '#E91E63' : '#fff' }}>{opponentPlayed.suit}</div>
              </div>
            ) : 'Opponent'}
          </div>
          <div className="battlefield-slot">
            {playerPlayed ? (
              <div className="card">
                <div className="card-value">{playerPlayed.value}</div>
                <div className="card-suit" style={{ color: playerPlayed.suit === '♥' || playerPlayed.suit === '♦' ? '#E91E63' : '#fff' }}>{playerPlayed.suit}</div>
              </div>
            ) : 'You'}
          </div>
        </div>
        
        <div className="player-hand">
          {playerHand.map((card, i) => (
            <div
              key={i}
              className={`card ${selectedCard === i ? 'selected' : ''}`}
              onClick={() => selectCard(i)}
            >
              <div className="card-value">{card.value}</div>
              <div className="card-suit" style={{ color: card.suit === '♥' || card.suit === '♦' ? '#E91E63' : '#fff' }}>{card.suit}</div>
            </div>
          ))}
        </div>
        
        <div className="message">{message}</div>
        
        <div className="actions">
          <button className="btn btn-primary" onClick={playCard} disabled={gameOver}>
            Play Card
          </button>
          <button className="btn btn-secondary" onClick={handleNewGame}>
            New Game
          </button>
        </div>

        <div className="leaderboard">
          <h3>🏆 Leaderboard</h3>
          {leaderboard.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#666' }}>No scores yet - be the first! 🃏</p>
          ) : (
            leaderboard.map((entry, i) => (
              <div key={entry.id} className="leaderboard-entry">
                <span>#{i + 1} {entry.playerName}</span>
                <span>{entry.score} pts</span>
              </div>
            ))
          )}
        </div>
      </div>

      {showPaywallModal && (
        <div className="paywall-overlay" onClick={() => setShowPaywallModal(false)}>
          <div className="paywall-modal" onClick={(e) => e.stopPropagation()}>
            <h2>🔒 Daily Limit Reached</h2>
            <p>{paywallMessage}</p>
            <button className="btn btn-primary" onClick={() => setShowPaywallModal(false)}>
              Got it
            </button>
          </div>
        </div>
      )}

      {showUpgradeModal && (
        <div className="paywall-overlay" onClick={() => setShowUpgradeModal(false)}>
          <div className="paywall-modal" onClick={(e) => e.stopPropagation()}>
            <h2>⭐ Unlock Premium</h2>
            <p>Get unlimited plays and an ad-free experience!</p>
            <ul className="premium-features">
              <li>✓ Unlimited daily games</li>
              <li>✓ One-time purchase, yours forever</li>
            </ul>
            <p className="premium-price">$2.99</p>
            <button className="btn btn-primary" onClick={() => window.open('https://buy.stripe.com/4gM8wIfh94I42yl5Xh7Re08', '_blank')}>
              Unlock Now
            </button>
          </div>
        </div>
      )}

      {showHelp && (
        <div className="paywall-overlay" onClick={() => setShowHelp(false)}>
          <div className="paywall-modal" onClick={(e) => e.stopPropagation()}>
            <h2>🎯 How to Play</h2>
            <div style={{ textAlign: 'left', marginTop: '1rem' }}>
              <p><strong>Goal:</strong> Score more points than your opponent by playing higher cards.</p>
              <p style={{ marginTop: '0.5rem' }}><strong>How to play:</strong></p>
              <ul style={{ marginLeft: '1.5rem', lineHeight: '1.8' }}>
                <li>Select one of your cards by clicking on it</li>
                <li>Click "Play Card" to challenge the opponent</li>
                <li>If your card is higher, you win the round and get points</li>
                <li>If opponent's card is higher, they win</li>
                <li>Tie = no points for either player</li>
              </ul>
              <p style={{ marginTop: '0.5rem' }}><strong>Card Values:</strong> 2 (lowest) → A (highest)</p>
              <p style={{ marginTop: '0.5rem' }}><strong>Scoring:</strong> Win a round = card value in points. First to 5 cards loses!</p>
            </div>
            <button className="btn btn-primary" style={{ marginTop: '1.5rem' }} onClick={() => setShowHelp(false)}>
              Got it!
            </button>
          </div>
        </div>
      )}

      {showWinModal && (
        <div className="paywall-overlay" onClick={() => setShowWinModal(false)}>
          <div className="paywall-modal" style={{ borderColor: '#4CAF50' }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ color: '#4CAF50' }}>🎉 You Win!</h2>
            <p>Congratulations on your victory!</p>
            <p className="premium-price">{playerScore + 1} pts</p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1rem' }}>
              <button className="btn btn-primary" onClick={() => setShowWinModal(false)}>
                Awesome!
              </button>
              <button className="btn btn-secondary" onClick={() => {
                const text = `I won Card Battle with ${playerScore + 1} points! Can you beat me? 🃏`;
                if (navigator.share) {
                  navigator.share({ text });
                } else {
                  navigator.clipboard.writeText(text);
                  setMessage('Score copied to clipboard!');
                }
              }}>
                Share
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
