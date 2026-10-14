import { storeMapLinks, storeRegions, STORES_FROM, type Draw, type Store } from "@/lib/lotto";

// 회차별 1등 배출점 목록과 지역별 개수
export default function LottoStores({ draw, stores }: { draw: Draw; stores: Store[] | undefined }) {
  const winners = draw.prizes[0][1];
  return (
    <section>
      <h2>1등 배출점</h2>
      {winners === 0 ? (
        <p className="note-sm">이 회차는 1등 당첨자가 없어 당첨금이 다음 회차로 이월됐습니다.</p>
      ) : draw.no < STORES_FROM ? (
        <p className="note-sm">동행복권은 {STORES_FROM}회부터 1등 배출점을 공개하고 있어, 이 회차의 판매점 정보는 없습니다.</p>
      ) : !stores ? (
        <p className="note-sm">이 회차의 1등 배출점 정보를 아직 불러오지 못했습니다. 동행복권 &gt; 판매점 &gt; 당첨 판매점 조회에서 확인할 수 있습니다.</p>
      ) : stores.length === 0 ? (
        <p className="note-sm">동행복권에 이 회차의 1등 배출점 정보가 공개되어 있지 않습니다.</p>
      ) : (
        <>
          <p className="note-sm">
            1등 {winners.toLocaleString("ko-KR")}게임 · 배출점 {stores.length}곳 ·{" "}
            {storeRegions(stores).map(([r, n]) => `${r} ${n}`).join(", ")}
          </p>
          <p className="note-sm">상호를 누르면 카카오맵에서 위치가, 길찾기를 누르면 길 안내가 새 창으로 열립니다.</p>
          <div className="scroll">
            <table className="stores">
              <thead><tr><th>상호</th><th>구분</th><th>소재지</th></tr></thead>
              <tbody>
                {stores.map((store, i) => {
                  const [name, kind, addr, old, closed] = store;
                  const links = storeMapLinks(store);
                  return (
                    <tr key={i}>
                      <th>
                        {links ? (
                          <a href={links.map} target="_blank" rel="noopener noreferrer" title={`${name} 위치를 카카오맵에서 보기`}>{name}</a>
                        ) : (
                          name
                        )}
                        {closed ? <span className="tag">폐점</span> : null}
                      </th>
                      <th>{kind}</th>
                      <th>
                        {addr}
                        {old && <small>당첨 당시: {old}</small>}
                        {links && (
                          <span className="maplinks">
                            <a href={links.route} target="_blank" rel="noopener noreferrer">길찾기</a>
                            <a href={links.naver} target="_blank" rel="noopener noreferrer">네이버지도</a>
                          </span>
                        )}
                      </th>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
