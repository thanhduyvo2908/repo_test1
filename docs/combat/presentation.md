# Trình diễn trận đấu

Mục tiêu: trận đấu của Xidle phô diễn được phần lớn vẻ đẹp chiêu thức trong sprite game đối kháng (MUGEN, Jump Ultimate Stars, Gigant Battle, GBA), mà vẫn hợp với một game idle đánh tự động theo lượt.

Luật trận nằm ở `CLAUDE.md`, mục "Khung chiến đấu". File này chỉ nói về cách hiển thị và phần dữ liệu cần cho việc hiển thị.

**Trạng thái:** bản nháp, chờ người dùng chọn ở mục 4.

## 1. Hiện trạng

Đo ngày 12/11/2026 trên `?pack=onepiece&demo=1`.

- `src/ui/screens/BattleScreen.tsx` phát nhật ký bằng `setTimeout` với thời gian chờ cố định: 420 ms cho sự kiện `action`, 160 ms cho các sự kiện khác, 60 ms cho `roundStart`. Phần hiển thị không biết hoạt ảnh dài bao lâu.
- Hoạt ảnh thật dài hơn nhiều: Pistol của Luffy 72 tick (1,2 giây), Bazooka 63 tick, siêu chiêu của Buggy 127 tick, của Don Krieg 142 tick. Kết quả: số sát thương và hoạt ảnh trúng đòn hiện khi người đánh mới vào thế, rồi lượt sau bắt đầu khi đòn trước chưa xong.
- `hitTick` đã có trong `sprite.json` nhưng `BattleScene.ts` chưa dùng.
- Mọi khung trong `sprite.json` đều có `dx = 0`. Lý do: MUGEN đẩy nhân vật bằng vận tốc (`VelSet`, `PosAdd` trong file `.cns`), không ghi trong khung hoạt ảnh. Vì vậy sprite xuất ra đánh tại chỗ. Riêng nhân vật có sprite (`!actor.sprite` trong `play`) hiện không lao tới.
- Mỗi đòn chỉ có một `hitTick`. File `.air` có hộp `Clsn1` (vùng gây sát thương) cho từng khung, nhưng `tools/mugen/air.ts` đang bỏ qua dòng `Clsn`.
- Trúng đòn chỉ đổi sang hoạt ảnh `hit` 8 tick. Chưa có dừng hình, tia lửa, rung màn hình hay bị đẩy lùi.
- Cảnh cao 220 px. Màn nhỏ: mỗi bên một người ở 27% và 73% chiều rộng, người chờ đứng nhỏ ở đáy. Trận boss: 5 nhân vật xếp cột so le bên trái, boss to bên phải.
- Hiệu ứng siêu chiêu có sẵn trong file MUGEN của nhân vật. Ví dụ Bazooka của Luffy (`Supers.cns`, state 3000): `SuperPause` dừng hình 100 tick, `BGPalFX` làm tối nền, `Explod` 7405 là luồng khí tụ lực, `VelSet` đẩy Luffy lao tới, `Explod` 7022 là tia va chạm. Các ảnh này nằm trong `Luffy_Start.sff`, không cần `fightfx`. Bộ One Piece Mugen V14 trong `assets-raw/op14/` không kèm `fightfx.sff`.
- Nhân vật lấy từ sheet GBA (Alvida, Morgan, Cabaji, Gin, Jango, lính) không có hộp `Clsn` và không có ảnh hiệu ứng riêng. Mốc trúng đòn đặt tay trong `tools/sprite-export-config.ts`.

## 2. Ràng buộc

- **Nhịp treo máy.** `docs/ui/research.md` đề xuất treo máy chạy 1 trận mỗi 30 giây, khớp thưởng offline 120 trận mỗi giờ. Tốc độ phát lại chỉ đổi cách xem.
- **Độ dài trận**, theo `npm run sim -- --pack onepiece` khi level ngang lính: màn nhỏ 5 lính kéo dài khoảng 6 vòng, tức 12 đến 20 lượt kể cả lượt của lính, cộng 5 lần lính gục và lính mới vào sân. Trận boss 5 đấu 1 có 6 lượt mỗi vòng; trận 15 vòng là 90 lượt.
- **Quỹ thời gian.** Muốn màn nhỏ vừa 30 giây thì trung bình mỗi lượt khoảng 1,5 đến 1,8 giây, kể cả lúc đi tới và quay về. Trận boss không lặp nên được dài hơn, nhưng 90 lượt × 1,5 giây là hơn 2 phút, nên cần nút ×2 và bỏ qua.
- **Phần hiển thị không tự tính sát thương.** Chia một số sát thương đã ghi trong nhật ký thành nhiều số nhỏ để hiện theo từng hit là phép chia để vẽ, tổng phải đúng bằng số trong nhật ký. Chí mạng, khắc hệ, ngẫu nhiên vẫn do engine quyết.
- **Không vẽ mới nhân vật có bản quyền.** Cut-in chỉ dùng khung sprite có sẵn, phóng to. Hiệu ứng chung như tia lửa, vệt chém, vòng sóng, bụi thì được vẽ.
- **Cảnh nhỏ.** Điện thoại rộng khoảng 400 px, cảnh cao khoảng 236 px. Đòn tay dài như Pistol đã tràn khỏi vùng của Luffy.
- **Hai loại nguồn sprite.** MUGEN có dữ liệu phong phú (`Clsn1`, `HitDef`, `VelSet`, `Explod`, `SuperPause`). Sheet GBA chỉ có khung hình. Mọi tính năng phải có đường lùi cho sheet GBA.

## 3. Ba mức tổng

| | A. Đánh bóng | B. Sân đấu đối kháng | C. Chạy lại MUGEN |
| --- | --- | --- | --- |
| Ý chính | Giữ cảnh hiện tại. Phát theo độ dài hoạt ảnh, hiện số đúng `hitTick`, thêm dừng hình, tia lửa, rung | A, cộng: lao tới và quay về, bị đẩy lùi, nhiều hit mỗi đòn, cut-in cho S3 và S4, máy quay, nén nhịp theo quỹ thời gian | Đọc một phần file `.cns` (`VelSet`, `PosAdd`, `Explod`, `Helper`, `Projectile`, `SuperPause`) và chạy lại đúng như MUGEN |
| Người lao tới thế nào | Nhích 28 px như khối hình hiện tại | Tính từ tầm với của khung trúng đòn: đòn ngắn thì lao sát, tay dài thì đứng xa | Đúng vận tốc trong MUGEN |
| Hiệu ứng | Tia lửa vẽ chung | Tia lửa vẽ chung, cộng hiệu ứng riêng của nhân vật lấy từ `.sff` (giai đoạn 2) | Hiệu ứng riêng đầy đủ, đúng vị trí |
| Sheet GBA | Như MUGEN | Như MUGEN, mốc hit và chế độ lao tới khai báo tay | Không có `.cns`, phải rơi về mức B |
| Sửa ở đâu | `src/render/`, `src/ui/` | `src/render/`, `src/ui/`, `tools/` (xuất thêm dữ liệu vào `sprite.json`), `src/save/` (cài đặt tốc độ) | Như B, cộng một trình thông dịch `.cns` trong `tools/` hoặc `src/render/` |
| Đổi luật hay engine | Không | Không, nếu chọn chia hit chỉ ở phần hình (mục 4.2) | Không |
| Công sức ước lượng | 2 đến 3 ngày | 1,5 đến 2,5 tuần, chia giai đoạn | Hơn 1 tháng |
| Rủi ro | Thấp. Vẫn trông như game lượt đơn giản | Vừa. Khó nhất là cân nhịp cho vừa 30 giây, và căn tầm với cho đòn tay dài | Cao. `.cns` của từng tác giả mỗi người một kiểu, biểu thức, biến, helper lồng nhau; chạy sai thì nhân vật bay khỏi màn |

**Đề xuất: B**, làm theo giai đoạn để có kết quả nhìn thấy sớm (mục 5.8).

## 4. Các điểm cần người dùng chọn

### 4.1 Mức tổng

A, B hay C, xem bảng ở mục 3.

### 4.2 Đòn nhiều hit

Ví dụ Gatling (S4 dự kiến của Luffy), chém ba nhát của Zoro, đạn liên tiếp của Usopp.

| | Chia ở phần hình | Engine tính từng hit |
| --- | --- | --- |
| Cách làm | Engine giữ nguyên, ghi 1 sự kiện `damage`. Phần hiển thị chia số đó theo số hit của hoạt ảnh (lấy từ `Clsn1` hoặc khai báo tay), hiện từng số nhỏ ở từng hit, rồi hiện tổng | Skill khai báo `hits` trong gói nội dung. Engine chia Power cho số hit, mỗi hit tự tung chí mạng và số ngẫu nhiên, ghi một sự kiện `damage` cho mỗi hit |
| Sửa ở đâu | `tools/`, `src/render/` | `src/content/schema.ts`, `src/core/battle.ts`, test, gói nội dung, chạy lại `npm run sim`; cộng phần của cột trái |
| Ưu | Không đụng cân bằng. Số hit đổi theo sprite mà không cần sửa skill | Chí mạng từng hit hiện thật, có thể làm hiệu ứng "mỗi hit có 10% gây chảy máu" |
| Nhược | Chí mạng là cả đòn hoặc không. Số hit trên màn có thể khác nhau giữa hai nhân vật dùng cùng thiết kế skill | Số hit phải khớp giữa dữ liệu skill và sprite. Tổng sát thương dao động ít hơn; cần cân lại. Nhật ký dài hơn |
| Công sức | Gồm trong B | Thêm 2 đến 3 ngày |

**Đề xuất:** chia ở phần hình. Nếu sau này cần hiệu ứng theo từng hit thì thêm trường `hits` vào skill mà không phải làm lại phần hình.

### 4.3 Nguồn hiệu ứng đánh trúng

| | Vẽ chung | Vẽ chung + hiệu ứng riêng của nhân vật | Thêm `fightfx` |
| --- | --- | --- | --- |
| Cách làm | Vẽ bằng PixiJS `Graphics` hoặc một sheet pixel tự vẽ: tia lửa đấm, vệt chém, vòng sóng, bụi chân, chớp trắng. Chọn theo kiểu đòn (đấm, chém, phép, đạn) | Như cột trái cho mọi đòn. Thêm: script xuất các `Explod` của chiêu từ `.sff` của nhân vật MUGEN (luồng khí tụ lực, tia va chạm riêng) thành hoạt ảnh `fx` trong atlas | Lấy `fightfx.sff` từ một bản MUGEN khác |
| Bản quyền | Của dự án | Đi cùng sprite nhân vật, ghi vào `CREDITS.md` như sprite | `fightfx` gốc của Elecbyte và bản cộng đồng; điều kiện dùng lại không rõ |
| Sheet GBA | Có | Chỉ hiệu ứng chung | Có |
| Công sức | 1 đến 2 ngày | Thêm 3 đến 4 ngày (đọc `Explod`, `postype`, vị trí, tỉ lệ) | 1 ngày, cộng tìm nguồn |

**Đề xuất:** vẽ chung trước, hiệu ứng riêng ở giai đoạn sau, không dùng `fightfx`.

### 4.4 Nhịp treo máy và mức trình diễn

Ba mức trình diễn: **Đầy đủ** (mọi lượt có lao tới, hit, quay về), **Chỉ siêu chiêu** (đòn thường và S1, S2 đánh tại chỗ, nhanh; S3, S4 có cut-in đầy đủ), **Tối giản** (chỉ số và thanh máu, giống hiện tại). Tốc độ ×1, ×2, ×4 và bỏ qua.

| | Nén tự động | Màn nhỏ mặc định "Chỉ siêu chiêu" | Xem trễ |
| --- | --- | --- | --- |
| Cách làm | Mặc định Đầy đủ. Trước khi phát, tính tổng thời gian; nếu vượt 30 giây thì rút ngắn theo thứ tự: bỏ đi tới và quay về của đòn thường, cắt phần đứng chờ cuối hoạt ảnh, tăng tốc đòn thường. Siêu chiêu không bị nén | Màn nhỏ dùng "Chỉ siêu chiêu", trận boss và ải phụ dùng Đầy đủ. Người chơi đổi được | Luôn phát Đầy đủ; xem chậm hơn nhịp thì trận kế tiếp chờ trong hàng |
| Ưu | Đẹp nhất có thể trong 30 giây, không cần người chơi chỉnh | Đơn giản, đoán trước được | Không mất gì của hoạt ảnh |
| Nhược | Phải viết bộ tính thời gian và test | Màn nhỏ kém đẹp | Phần xem trễ dần so với phần thưởng thật; người chơi thấy kết quả cũ |

**Đề xuất:** nén tự động. Cài đặt mức trình diễn và tốc độ lưu trong cài đặt của file lưu.

### 4.5 Cận chiến hay tầm xa

Khai báo ở đâu việc một đòn phải lao tới hay đứng tại chỗ bắn.

**Đề xuất:** khai báo trong dữ liệu sprite (`tools/sprite-export-config.ts`, xuất ra `sprite.json`), không thêm vào schema skill. Lý do: đây là chuyện của hoạt ảnh, không phải luật. Cùng một skill "đánh một địch Power 80" có thể là cú đấm hay phát súng tùy sprite. Engine và gói nội dung không đổi.

Mặc định tự suy: đo tầm với của khung trúng đòn (từ hộp `Clsn1`, hoặc từ cạnh trước của ảnh). Người chơi lao tới vừa đủ để tầm với chạm mục tiêu; tay dài như Pistol thì gần như đứng yên. Đòn bắn đạn (Usopp, Buggy) khai báo tay `approach: "stay"` kèm hoạt ảnh đạn nếu có.

### 4.6 Chuỗi combo trình diễn

Câu hỏi của người dùng ngày 12/11/2026: chỉ dựa vào sprite, Claude có tự cho nhân vật đánh một chuỗi combo đẹp như game thủ có kinh nghiệm không.

Ý tưởng: một ô skill không phát một hoạt ảnh mà phát một chuỗi hoạt ảnh. Ví dụ S1 của Luffy: đấm nhẹ, đấm nhẹ, đá, rồi Pistol. Engine vẫn ghi 1 sự kiện `damage`; phần hình chia số đó cho mọi hit trong chuỗi (mục 4.2).

Dữ liệu có sẵn, kiểm tra trên `assets-raw/op14/chars/Luffy_Start/`:

- **Ảnh khung (`.sff`, `.air`) một mình không đủ.** Ảnh cho biết đòn trông thế nào, không cho biết đòn nào nối được vào đòn nào và nối ở khung nào.
- **Nhân vật MUGEN có kèm luật nối đòn.** Trong `Luffy_Start.cns`, state 200 (đấm nhẹ) có `ChangeState` sang 210, 300, 400 với điều kiện `movecontact`: trúng đòn thì được hủy phần thu chiêu để ra đòn kế. Gom các điều kiện này lại thành một đồ thị nối đòn, từ đó chọn đường nối hợp lệ. Điểm hủy cho biết cắt hoạt ảnh ở đâu để chuỗi liền mạch.
- **AI của tác giả** (`IA.cns`) ghi khi nào AI dùng siêu chiêu, theo khoảng cách và lượng power. Đây là gợi ý về cách tác giả muốn nhân vật được chơi.
- **`HitDef`** cho thời gian dừng hình (`pausetime`), kiểu trúng đòn (`animtype`), tia lửa riêng (`Explod` 7001 "Spark CVS" của Luffy).
- **Sheet GBA không có các dữ liệu trên.** Chuỗi phải chọn bằng mắt: xem khung, đặt thứ tự và điểm cắt tay.

Claude làm được:

- Trích đồ thị nối đòn từ `.cns` và `.cmd`, đề xuất 1 đến 3 chuỗi hợp lệ cho mỗi ô skill, cắt hoạt ảnh ở điểm hủy, xuất ảnh xem trước (dải khung hoặc GIF) để người dùng duyệt.
- Với sheet GBA: đề xuất chuỗi bằng cách xem khung, gắn nhãn **Đề xuất**.

Claude không làm được, hoặc làm kém:

- Combo tung người lên không (juggle), dồn góc, giữ khoảng cách: phụ thuộc vật lý của MUGEN (trọng lực, vận tốc bị đánh bay). Không chạy lại vật lý thì chỉ giả lập được bằng chuyển động đơn giản: mục tiêu bị đẩy lùi, bị hất lên rồi rơi.
- Biết chuỗi nào "đẹp" theo cảm giác người chơi lâu năm. Chọn theo luật nối đòn cho chuỗi hợp lệ và trông liền mạch, nhưng chuỗi tủ của cộng đồng (BnB) phải tra video hoặc để người dùng chọn.

Ràng buộc nhịp: chuỗi dài làm lượt dài. Đòn thường và S1, S2 nên 2 đến 4 hit, gói trong khoảng 1 giây; chuỗi dài để dành cho S3, S4.

Công sức: trích đồ thị nối đòn và cắt hoạt ảnh 3 đến 4 ngày, trong `tools/` và `sprite.json`. Phần phát chuỗi trong `src/render/` gần như miễn phí nếu đã làm mức B. Không đổi engine hay schema skill.

Phát hiện phụ: trong `Luffy_Start.cmd`, action 3000 có tên "Gomu Gomu no Storm", không phải Bazooka. `docs/characters/luffy.md` đang dùng action 3000 cho S3 Bazooka.
