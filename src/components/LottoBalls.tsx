import { ballTone } from "@/lib/lotto";

// 로또 공 묶음. 보너스 번호가 있으면 + 뒤에 붙여 보여 줍니다.
export default function LottoBalls({ nums, bonus, size }: { nums: number[]; bonus?: number; size?: "sm" }) {
  const cls = (n: number) => `ball t${ballTone(n)}${size ? ` ${size}` : ""}`;
  return (
    <span className="balls" role="img" aria-label={`${nums.join(", ")}${bonus ? `, 보너스 ${bonus}` : ""}`}>
      {nums.map((n) => <span key={n} className={cls(n)}>{n}</span>)}
      {bonus !== undefined && (
        <>
          <span className="plus" aria-hidden="true">+</span>
          <span className={cls(bonus)}>{bonus}</span>
        </>
      )}
    </span>
  );
}
