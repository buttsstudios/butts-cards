'use client';

import { useState, useEffect } from 'react';
import { saveScore, getLeaderboard } from '@/lib/firebase';

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

export default function ButtsCards() {
  const [playerName, setPlayerName] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [playerHand, setPlayerHand] = useState<Card[]>([]);
  const [opponentHand, setOpponentHand] = useState<Card[]>([]);
  const [selectedCard, setSelectedCard] = useState<number | null>(null);
  const [playerScore, setPlayerScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [round, setRound] = useState(1);
  const [message, setMessage] = useState('Enter your name to play');
  const [playerPlayed, setPlayerPlayed] = useState<Card | null>(null);
  const [opponentPlayed, setOpponentPlayed] = useState<Card | null>(null);
  const [leaderboard, setLeaderboard] = useState<Score[]>([]);
  const [gameOver, setGameOver] = useState(false);

  useEffect(() => {
    if (isLoggedIn) {
      loadLeaderboard();
      newGame();
    }
  }, [isLoggedIn]);

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
    setPlayerScore(0);
    setOpponentScore(0);
    setRound(1);
    setSelectedCard(null);
    setMessage('Select a card to play');
    setPlayerPlayed(null);
    setOpponentPlayed(null);
    setGameOver(false);
    dealCards();
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (playerName.trim()) {
      setIsLoggedIn(true);
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
      let finalMessage = '';
      const finalPlayerScore = playerCard.power > opponentCard.power ? playerScore + 1 : playerScore;
      const finalOpponentScore = playerCard.power < opponentCard.power ? opponentScore + 1 : opponentScore;
      
      if (finalPlayerScore > finalOpponentScore) {
        finalMessage = `Game Over - You Win! (${finalPlayerScore}-${finalOpponentScore})`;
        saveScore(playerName, finalPlayerScore);
      } else if (finalPlayerScore < finalOpponentScore) {
        finalMessage = `Game Over - You Lose! (${finalOpponentScore}-${finalPlayerScore})`;
      } else {
        finalMessage = `Game Over - Tie! (${finalPlayerScore}-${finalOpponentScore})`;
      }
      setMessage(finalMessage);
      loadLeaderboard();
    } else {
      setMessage(roundMessage);
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="login-overlay">
        <div className="login-box">
          <h1>Butts Cards</h1>
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
        <h1>Butts Cards</h1>
        <div className="stats">
          <div className="stat">Player: {playerName}</div>
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
          <button className="btn btn-secondary" onClick={newGame}>
            New Game
          </button>
        </div>

        <div className="leaderboard">
          <h3>🏆 Leaderboard</h3>
          {leaderboard.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#666' }}>No scores yet</p>
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
    </div>
  );
}
