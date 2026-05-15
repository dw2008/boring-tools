import { Chessboard } from 'react-chessboard'

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

export default function Board() {
  return (
    <div className="flex flex-col items-center justify-center w-full h-full px-4">
      {/* Match header */}
      <div className="flex items-center justify-between w-full max-w-[720px] mb-3 px-1">
        <span className="text-[12px] text-text-muted font-mono uppercase tracking-widest">
          MATCH: <span className="text-text-primary">Elo 2450 vs Aether Engine</span>
        </span>
        <span className="text-[12px] text-text-muted font-mono">⏱ 14:22</span>
      </div>

      {/* Board */}
      <div className="w-full max-w-[720px] aspect-square">
        <Chessboard
          position={START_FEN}
          boardWidth={undefined}
          customDarkSquareStyle={{ backgroundColor: '#1B242D' }}
          customLightSquareStyle={{ backgroundColor: '#2D3E50' }}
        />
      </div>
    </div>
  )
}
