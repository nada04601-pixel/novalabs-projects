"use client";
import { useState } from "react";
import type { SimDraw } from "@/lib/lotto";
import LottoGenerator from "@/components/LottoGenerator";
import LottoSimulator from "@/components/LottoSimulator";

// 번호 생성기와 시뮬레이터를 한 화면에 두고, 만든 번호를 바로 시뮬레이션으로 넘깁니다.
export default function LottoLab({ draws }: { draws: SimDraw[] }) {
  const [picked, setPicked] = useState<{ nums: number[]; key: number }>();
  return (
    <>
      <h2 style={{ marginTop: 0 }}>1. 번호 만들기</h2>
      <LottoGenerator draws={draws} onPick={(nums) => setPicked({ nums, key: Date.now() })} />
      <h2>2. 매주 샀다면 얼마? 시뮬레이션</h2>
      <p className="note-sm">위에서 만든 번호의 "이 번호로 시뮬레이션"을 누르거나, 늘 사는 번호를 직접 넣어 보세요.</p>
      <LottoSimulator draws={draws} picked={picked} />
    </>
  );
}
