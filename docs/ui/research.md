# Nghiên cứu giao diện Xidle

Soạn ngày 12/11/2026. Tài liệu gồm hiện trạng giao diện, phần tham khảo Poke'Catch, ba phương án kèm ưu nhược, phương án người dùng chọn và danh sách việc cho session chính.

Nhãn **Đề xuất** đánh dấu chi tiết chưa được người dùng duyệt. Ngày 12/11/2026 người dùng chọn phương án A (mục 4), duyệt mockup và trả lời các câu hỏi ở mục 7. Hai mục chưa có mockup, 5.8 (đội hình, nhân vật) và 5.9 (item), vẫn là **Đề xuất**.

Tài liệu đi kèm:

- `docs/ui/mockup.html`: mockup tĩnh của phương án đã chọn, dùng sprite thật của gói onepiece. Mở qua dev server: `http://localhost:5173/docs/ui/mockup.html`. Tham số `?lang=vi` chuyển sang tiếng Việt, `?view=adventure|maps|mapinfo|boss|recruit|desktop` hiện một màn ở đúng kích thước cửa sổ.
- `docs/ui/shots/current/`: ảnh chụp giao diện hiện tại ở 400px.
- `docs/ui/shots/pokecatch/`: ảnh chụp Poke'Catch, chỉ để tham khảo. **Không commit** thư mục này vì đó là ảnh của game khác.
- `docs/ui/shots/mockup/`: ảnh chụp mockup. Ảnh có sprite rip nên cũng không nên commit, theo luật sprite trong `CLAUDE.md`.

## 1. Quyết định của người dùng (12/11/2026)

| Câu hỏi | Người dùng chọn |
| --- | --- |
| Phong cách hình ảnh | Pixel tối như Poke'Catch |
| Tổ chức màn chính | Trận luôn chạy ở màn chính, chọn map bằng bảng trượt |
| Bố cục máy tính | 3 cột như Poke'Catch |
| Game tham khảo thêm | Chỉ Poke'Catch |
| Mockup `docs/ui/mockup.html` | Duyệt |
| Tốc độ phát lại | Treo máy chạy theo nhịp cố định, khớp thưởng offline (120 trận mỗi giờ, tức 1 trận mỗi 30 giây). Tốc độ ×1 ×2 ×4 chỉ đổi cách xem, không đổi thu nhập |
| Thua ở màn nhỏ | Dừng lặp, hiện hai nút "Thử lại" và "Về màn trước". Không tự lùi màn |
| Giao diện sáng | Không. Chỉ một giao diện tối |
| Font pixel | Tiny5 |
| Rút gọn số | K và M cho cả hai ngôn ngữ (người dùng không chọn khác) |

Mục 5 là bản đã duyệt, trừ 5.8 và 5.9.

## 2. Hiện trạng

Kiểm tra ngày 12/11/2026 bằng `?pack=onepiece`, cửa sổ 400 × 800, với một file lưu thử giữa game: đã qua 6 map, đang ở map 7 màn 5, đội 5 người, có 4 item, vắng mặt 2 giờ 30 phút. File lưu thử chỉ nằm trong trình duyệt của app; tham số `demo=1` chưa có trong code lúc kiểm tra. Ảnh ở `docs/ui/shots/current/`.

### Chung cho mọi màn

- Nền kem sáng, chữ hệ thống, thẻ trắng. Trông giống trang quản trị hơn là game. Có chế độ tối theo cài đặt máy nhưng vẫn là giao diện ứng dụng.
- Tiêu đề, thanh tài nguyên và tab chiếm khoảng 130px đầu trang. Tab không dính, nên ở màn dài người chơi phải cuộn lên đầu mới đổi được tab.
- Ngoài cảnh trận, không màn nào có sprite hay chân dung nhân vật. Nhân vật chỉ hiện bằng tên và nhãn hệ.
- Thanh tài nguyên ghi số đầy đủ (161,190) và không có biểu tượng. Ở 400px bốn mục vừa đủ một dòng; số lớn hơn sẽ xuống dòng.
- Bộ chọn ngôn ngữ là ô `select` gốc của trình duyệt, nằm ở tiêu đề.
- Tiếng Việt hiển thị đủ, tên dài như "Sân thượng quán rượu của Buggy" vẫn vừa một dòng (`current/11-maps-vi.jpg`).

### Danh sách map (`current/01-maps.jpg`)

- 12 thẻ cao bằng nhau xếp dọc. Map đang đánh không được làm nổi.
- Không gom theo arc, không có level đề nghị, không có chân dung boss.
- Map khóa chỉ ghi "Locked", không nói cần làm gì để mở.
- Ải phụ nằm dưới cả 12 map, phải cuộn khoảng 1.900px mới thấy. Người chơi dễ không biết có ải phụ và có 3 lượt mỗi ngày.

### Thông tin map (`current/03-mapinfo.jpg`, `current/04-mapinfo-stages.jpg`)

- Trang dài khoảng 1.300px. Danh sách skill boss đẩy lưới màn nhỏ và nút "Challenge boss" xuống cuối.
- Nút quay lại là liên kết chữ nhỏ ở đầu trang.
- Phần lính chỉ có tên, hệ, khoảng level; không cho biết mỗi màn có mấy lính.
- Ô màn nhỏ đã qua chỉ ghi "Cleared". Ô hiện tại ghi số lính.
- Thông tin đủ theo `CLAUDE.md` (lính, hệ, boss, level, skill, item, tỉ lệ chiêu mộ), chỉ thiếu cách trình bày.

### Trận đấu (`current/05-battle.jpg`, `current/06-battle-lower.jpg`)

- Canvas trống 1 đến 3 giây lúc PixiJS tải, không có báo đang tải.
- Nền cảnh là một mảng xám phẳng.
- Tên đơn vị và số sát thương bay đè lên nhau (tên "Black Cat Scout" bị số −26 che).
- Hoạt ảnh skill lớn như Gum-Gum Pistol tràn khỏi vùng của Luffy, che tên địch. Đây là việc của khung cảnh; giao diện chỉ cần chừa chỗ.
- Lính chưa có sprite hiện bằng hình tròn xanh.
- Danh sách thẻ hai cột (5 người chơi, tối đa 5 lính) cao khoảng 350px. Nhật ký chữ và nút "Skip" bị đẩy ra ngoài màn hình đầu.
- Nhật ký chỉ hiện 3 đến 8 dòng gần nhất.
- Không có nút đổi tốc độ phát lại. Chỉ có dòng chữ nhỏ "Wins this session".
- Trận chỉ chạy khi đang mở màn trận. Sang tab Team hay Items là vòng treo máy dừng; đây là vấn đề lớn nhất với một game idle.

### Đội hình (`current/07-team.jpg`)

- Hai danh sách, "Battle order" và "Roster", lặp cùng tên nhân vật.
- Đổi thứ tự bằng chữ "↑ Move up". Chọn vào đội bằng viền đỏ, khó nhận ra.
- Nút "Details" tách khỏi dòng nhân vật.

### Chi tiết nhân vật (`current/08-character.jpg`, `current/09-character-bottom.jpg`)

- Một cột dài khoảng 1.700px: chỉ số, lên level, thứ tự skill, item, sao.
- Phân điểm bằng nút − và +, mỗi lần 1 điểm. Luffy level 16 có 48 điểm, tức 48 lần chạm.
- Lên level từng cấp một, kể cả khi đủ vàng cho nhiều cấp.
- Chọn item bằng ô `select` gốc.
- Không có sprite hay chân dung nhân vật.

### Túi đồ (`current/10-items.jpg`)

- Mỗi item có nút "Break into N dust" to bằng cả thẻ, không hỏi xác nhận, kể cả với item Huyền thoại đang đeo. Đây là thao tác không hoàn tác được.
- Không lọc, không sắp xếp. Ô đổi bụi dùng `select` gốc.

### Thưởng offline (`current/02-offline.jpg`)

- Hộp thoại rõ ràng: thời gian vắng mặt, số trận, vàng và food.
- Tài nguyên đã được cộng vào thanh trên trước khi bấm "Collect". Nhãn nút nên là "OK" hoặc phần thưởng chỉ cộng khi bấm.

## 3. Tham khảo: Poke'Catch

Xem ngày 12/11/2026 tại https://pokecatch-online.netlify.app/ bằng một game mới (không đăng nhập), ở 400px và 1280px. Ảnh ở `docs/ui/shots/pokecatch/`.

### Cấu trúc ở điện thoại

- **Thanh trên dính** (`01-adventure.jpg`): chân dung người chơi, số Pokémon đã bắt, tiền, nút lưu, nút cài đặt.
- **Dòng tin chạy**: thành tích của người chơi khác, cùng tin của chính mình ("You caught Pidgey (new)").
- **Dải tiến độ route**: tên route, các nút màn bằng biểu tượng, nút hiện tại có khung, và đếm "2/20".
- **Cảnh trận**: ảnh nền theo vùng, sprite pixel, thanh máu nhỏ trên đầu, đồng hồ ngày đêm, nút tốc độ ×1 ×2 ×3. Một khung chữ trắng ở đáy cảnh kể sự kiện hiện tại ("A wild Pidgey appeared!", "You threw a Poké Ball! (60%)").
- **Thẻ chương hiện tại** dưới cảnh: huy hiệu, "Kanto · Chapter 1", khoảng level đề nghị, mũi tên mở bảng chọn.
- **"Found here"**: danh sách Pokémon của route kèm tỉ lệ gặp, hình bóng đen cho con chưa bắt.
- **Thanh điều hướng dưới dính**: nút "Adventure" lớn màu đỏ cùng 7 biểu tượng nhỏ. Tab đang mở đổi thành nút đỏ có chữ.

### Bảng chọn chương (`02-progress.jpg`, `03-chapter-info.jpg`)

- Trượt lên từ dưới, phủ màn trận.
- Đầu bảng là dải vùng (Kanto, Johto khóa với điều kiện "Finish Kanto to unlock").
- Danh sách gym: số thứ tự, chân dung trưởng gym trên ảnh nền, level đề nghị. Gym khóa ghi "Locked".
- Khu phụ (Cerulean Cave, Power Plant) xen giữa danh sách gym, có điều kiện mở và tiến độ riêng.
- Bấm một gym mở thẻ chi tiết: ảnh nền lớn, trưởng gym và hệ, level đề nghị, giới hạn level, phần thưởng, item và Pokémon có ở đây, nút "CONTINUE".

### Đội hình (`04-team.jpg`)

- Nhiều bộ đội lưu sẵn (tab 1 đến 5), điểm level trung bình.
- Lưới 3 cột, mỗi ô có sprite, hệ, level và chiêu. Ô trống ghi "Free slot".
- Kho (PC) bên dưới có ô tìm kiếm và bộ lọc.

### Máy tính (`05-desktop.jpg`)

- Thanh bên trái: thẻ chương hiện tại có tiến độ, rồi danh sách mục (Progress, Team/PC, Pokédex, Activities, Social, Shop, Achievements).
- Cột giữa: dải route, cảnh trận lớn, dòng tin ngay dưới cảnh.
- Cột phải: "Found here".
- Tab khác (ví dụ Team/PC) thay cột giữa.

### Lấy gì, bỏ gì

Lấy:

- Màn chính luôn có trận đang chạy, kèm dải tiến độ và khung chữ kể sự kiện.
- Chọn map bằng bảng trượt lên, có danh sách theo nhóm, mục khóa có điều kiện mở, khu phụ xen giữa.
- Thẻ thông tin map có ảnh nền, boss, các con số chính và một nút hành động.
- Thẻ "NEW" khi có nhân vật mới.
- Nền tối, khung pixel viền đen, nút có mép dưới đậm, font pixel cho tiêu đề và số.
- Bố cục 3 cột trên máy tính.

Bỏ (ngoài phạm vi v1 hoặc không hợp Xidle):

- Đăng nhập Discord, Google; tin của người chơi khác; cửa hàng; mạng xã hội. Xidle không có tài khoản và server.
- Ngày đêm, thời tiết và tỉ lệ gặp. Xidle không có cơ chế gặp ngẫu nhiên.
- Tám tab dưới. Xidle hiện chỉ cần bốn.

## 4. Các phương án

### Phương án A: Hub phiêu lưu pixel, theo Poke'Catch (người dùng chọn)

Màn "Phiêu lưu" luôn có cảnh trận đang treo máy. Chọn map bằng bảng trượt. Nền tối, font pixel cho tiêu đề. Máy tính 3 cột.

Ưu điểm:

- Đúng cảm giác idle: người chơi luôn thấy đội đang đánh và tài nguyên đang tăng.
- Bám sát mẫu đã chọn trong `CLAUDE.md`, ít phải tự nghĩ luồng.
- Hợp với sprite GBA và MUGEN đang dùng.
- Màn hình đầu ở điện thoại chứa đủ: tiến độ, trận, đội, map, kẻ địch.

Nhược điểm:

- Phải tách vòng treo máy khỏi màn trận, đưa lên mức ứng dụng. Đây là việc lớn nhất.
- Font pixel cần có dấu tiếng Việt. Phần lớn font pixel thiếu (xem 5.1).
- Cảnh trận đẹp cần ảnh nền theo map, hiện chưa có.
- Viết lại gần hết `styles.css` và khung `App.tsx`.

### Phương án B: Giữ luồng tách màn, làm đẹp lại

Giữ danh sách map → thông tin map → trận đấu. Thêm sprite, chân dung, tab dính và thu gọn từng màn.

Ưu điểm:

- Ít thay đổi kiến trúc. Làm được dần từng màn.
- Màn thông tin map vẫn đủ chỗ cho skill boss dài.

Nhược điểm:

- Trận vẫn dừng khi rời màn trận, trái với cảm giác idle.
- Người chơi phải qua ba màn mới thấy trận. Ở điện thoại mỗi lần đổi màn nhỏ là một lần quay lại.
- Không giống mẫu Poke'Catch.

### Phương án C: Chủ đề hải tặc One Piece

Giấy da, bản đồ biển, thẻ boss dạng lệnh truy nã, màu gỗ và vàng. Luồng có thể theo A hoặc B.

Ưu điểm:

- Có bản sắc riêng, hợp World 1.
- Lệnh truy nã là chỗ tự nhiên để hiện boss, tỉ lệ chiêu mộ và item.

Nhược điểm:

- Game là crossover. World Naruto và Dragon Ball sẽ cần bộ giao diện khác, hoặc chủ đề hải tặc sẽ lạc lõng.
- Cần nhiều hình vẽ (giấy, khung gỗ), tốn công hơn khung pixel đơn giản.
- Nền sáng kiểu giấy kém hợp với sprite rip có viền tối.

Có thể giữ một phần của C trong A: khung tiêu đề của map dùng màu và họa tiết theo World. Ghi ở 5.10.

## 5. Chi tiết phương án A

Người dùng duyệt ngày 12/11/2026 qua mockup, trừ 5.8 và 5.9 (chưa có mockup, vẫn là **Đề xuất**). Mockup: `docs/ui/mockup.html`. Ảnh: `docs/ui/shots/mockup/`.

### 5.1 Phong cách

- Nền xanh đêm `#11131d`, khung `#1d2133`, viền đen 2px và viền trong mảnh, bo góc 4 đến 6px.
- Nút chính đỏ `#e2453c` với mép dưới đậm 4px. Nút phụ xám xanh. Nút vàng cho hành động thưởng.
- Màu 7 hệ đặt thành biến CSS, dùng chung cho nhãn hệ, viền thẻ và cảnh trận: Kim `#aab4c3`, Mộc `#4caf50`, Thủy `#3d8bf2`, Hỏa `#ef5a3c`, Thổ `#c08a3e`, Ánh sáng `#f2d45c`, Bóng tối `#8a5cd6`. `src/ui/sceneColors.ts` đọc màu cho canvas từ biến CSS (`--el-<hệ>`, `--text`, `--muted`, `--surface`, `--hp`, `--hp-low`, `--lose`), nên bảng màu mới phải giữ các tên biến này, hoặc sửa `sceneColors.ts` theo.
- Màu bậc item: Thường xám, Hiếm xanh dương, Sử thi tím, Huyền thoại vàng.
- **Font.** Font pixel chỉ dùng cho tiêu đề, số và nhãn ngắn. Chữ dài (mô tả skill, nhật ký) dùng font hệ thống cho dễ đọc. Đã kiểm tra trên Google Fonts ngày 12/11/2026, font pixel có bộ ký tự tiếng Việt: **Tiny5**, **VT323**, **Handjet**. Không có: Pixelify Sans, Press Start 2P, Silkscreen, Jersey 10, DotGothic16. Người dùng chọn **Tiny5**; dấu tiếng Việt đọc được ở cỡ 13px trở lên (`mockup/2-world-vi.jpg`). Game nên tự chứa file font (giấy phép OFL) thay vì tải từ Google, để chạy được khi không có mạng, và ghi vào `CREDITS.md`.
- Sprite và chân dung vẽ bằng `image-rendering: pixelated`, phóng theo bội số để không nhòe.
- Chỉ một giao diện tối (người dùng chọn). Bỏ nhánh `prefers-color-scheme` trong `styles.css`.

### 5.2 Khung ứng dụng

**Điện thoại, dưới 720px** (`mockup/1-adventure-en.jpg`):

1. Thanh trên dính, cao khoảng 50px: logo, vàng, food (rút gọn 161K), nút cài đặt. Bụi và đá sao chỉ hiện ở tab Item và trong cài đặt, để thanh trên vừa 400px. Ngôn ngữ chuyển vào cài đặt.
2. Dòng tin, một dòng: sự kiện gần nhất của chính người chơi (chiêu mộ, rơi item, mở map, thắng ải phụ). Chạm để xem cả danh sách trong phiên.
3. Nội dung tab, cuộn được.
4. Thanh điều hướng dưới dính, 4 tab: **Phiêu lưu** (rộng hơn), **Thế giới**, **Đội hình**, **Item**. Tab Thế giới có huy hiệu số lượt ải phụ còn lại hôm nay.

**Máy tính bảng, 720 đến 1099px:** thanh bên trái thay thanh dưới. Phần "Ở đây có" xuống dưới cảnh trận như ở điện thoại.

**Máy tính, từ 1100px** (`mockup/6-desktop-en.jpg`):

- Thanh trên: logo, dòng tin, bốn tài nguyên đầy đủ, nút ngôn ngữ, nút cài đặt.
- Cột trái 240px: thẻ map hiện tại (tên, tiến độ, vàng mỗi giờ), rồi 4 mục điều hướng.
- Cột giữa: nội dung tab. Ở tab Phiêu lưu là dải màn, cảnh trận lớn, dải đội, nhật ký.
- Cột phải 320px: ở tab Phiêu lưu là "Ở đây có" (boss, skill, item rơi, lính, gợi ý khắc hệ). Ở tab khác là **cảnh trận thu nhỏ**, để người chơi luôn thấy trận đang chạy khi chỉnh đội hay item. Poke'Catch ẩn trận khi sang tab khác; đây là điểm Xidle làm khác.

### 5.3 Luồng chuyển màn

```
Mở game ─► (thưởng offline, nếu vắng ≥ 1 phút) ─► Phiêu lưu
                                                   │
 Phiêu lưu ── chạm thẻ map ───────────► Bảng Thế giới ── chạm map ──► Thông tin map
     ▲                                     │                            │
     │                                     └─ chạm ải phụ ─► Trận ải phụ │
     │                                                                  ├─ "Treo màn N" ─► Phiêu lưu (màn N)
     │                                                                  └─ "Đánh boss" ──► Trận boss
     │                                                                                       │
     └──────────────── kết quả trận boss / ải phụ (thẻ thắng, chiêu mộ, thua) ◄──────────────┘

 Đội hình ── chạm nhân vật ─► Chi tiết nhân vật (bảng trượt)      Item ── chạm item ─► Chi tiết item
```

- Bảng Thế giới, Thông tin map, Chi tiết nhân vật là **bảng trượt lên** phủ tab hiện tại, đóng bằng ✕, vuốt xuống, hoặc nút quay lại của trình duyệt. Trận ở dưới vẫn chạy.
- Trận boss và ải phụ chạy ngay trong cảnh của tab Phiêu lưu, thay cho màn nhỏ đang treo. Dòng tin ghi "Đánh boss · tạm dừng treo máy". Hết trận thì hiện thẻ kết quả, rồi quay lại treo màn nhỏ cũ, hoặc sang map mới nếu người chơi chọn.
- Luật "màn nhỏ tự lặp lại cho tới khi người chơi đổi màn hoặc đội thua" giữ nguyên. Khi thua, cảnh hiện thẻ "Đội thua" với hai nút: "Thử lại" và "Về màn N−1" (màn cao nhất đã qua). Không tự lùi màn.

### 5.4 Tab Phiêu lưu

Từ trên xuống, ở 400px (`mockup/1-adventure-en.jpg`, `mockup/1-adventure-vi.jpg`):

1. **Dải màn nhỏ**: "Màn 5", 10 đến 15 ô (đã qua xanh, hiện tại vàng, chưa mở tối), chấm đỏ cho boss ở cuối, đếm "5/10". Chạm một ô đã mở để treo màn đó.
2. **Cảnh trận** cao khoảng 236px:
   - Góc trái trên: số trận thắng trong phiên, lính thứ mấy trên tổng số ("Địch 2/3").
   - Góc phải trên: tốc độ phát lại ×1 ×2 ×4 và nút bỏ qua ⏭. Tốc độ chỉ đổi cách xem: treo máy chạy theo nhịp cố định 1 trận mỗi 30 giây (lấy từ số trận mỗi giờ của thưởng offline). Xem xong sớm thì cảnh hiện đồng hồ đếm tới trận kế tiếp.
   - Trên đầu mỗi đơn vị đang ra sân: tên, nhãn hệ, thanh máu. Đặt nhãn ở độ cao cố định trên cùng cảnh, không bám theo khung hình, để hoạt ảnh lớn không đẩy nhãn đi và số sát thương không đè lên tên.
   - Người chờ ra sân đứng nhỏ ở góc dưới mỗi bên, như hiện tại.
   - Số sát thương bay lên từ thân mục tiêu. Kèm chữ "Khắc hệ ×2" (vàng) hoặc "Ít hiệu quả" (xám), chí mạng màu vàng to hơn.
   - **Khung chữ** ở đáy cảnh, một dòng: "Luffy dùng Gum-Gum Pistol!". Câu ghép từ sự kiện trong nhật ký theo ngôn ngữ đang chọn, như luật nhật ký trong `CLAUDE.md`.
   - Khi PixiJS đang tải: hiện khung cảnh với chữ "Đang tải…", không để trống.
3. **Dải đội**: 5 ô chân dung bằng nhau, level, thanh máu, biểu tượng hiệu ứng lớn nhất (khiên, choáng, giảm thủ). Ô đang ra sân có viền vàng; nhân vật gục mờ đi. Thay cho danh sách thẻ hai cột hiện tại. Chạm một ô mở chi tiết nhân vật.
4. **Hai thẻ treo máy**: vàng mỗi giờ ở màn hiện tại (tính từ phần thưởng màn nhỏ và số trận mỗi giờ), công tắc "Tự đi tiếp" (`autoAdvance` đã có trong store).
5. **Thẻ map hiện tại**: chân dung boss, arc và số map ("Syrup Village · Map 7/12"), tên map, trạng thái boss ("Boss khóa: còn 6 màn nhỏ" hoặc nút "Đánh boss" khi đã mở). Chạm mở Bảng Thế giới.
6. **Ở đây có**: lính và boss của map với chân dung, hệ, level, tỉ lệ chiêu mộ. Dòng **gợi ý khắc hệ** đọc bảng khắc trong cấu hình cân bằng: hệ nào khắc hệ của map, ai trong roster có hệ đó, ai trong đội đang bị khắc. Chỉ đọc dữ liệu, không tính sát thương.
7. **Nhật ký trận**, thu gọn 3 dòng, mở rộng ra cả trận. Dòng khắc hệ tô vàng. Hệ số ×2, ×0,5 đọc từ sự kiện trong nhật ký, không tự tính.

### 5.5 Bảng Thế giới

`mockup/2-world-vi.jpg`.

- Đầu bảng: tên World, số boss đã hạ trên tổng, giới hạn level. Chưa có World 2 thì không hiện dải World. Khi có thì thêm dải ngang như dải vùng của Poke'Catch.
- Map gom theo **arc** (Romance Dawn, Orange Town, Syrup Village, Baratie), mỗi arc ghi số boss đã hạ. Gói dữ liệu hiện chưa có trường arc cho map; cần thêm (xem mục 6).
- Mỗi dòng map: số thứ tự, chân dung boss, tên map, khoảng level lính, hệ, và cờ trạng thái: ✓ đã hạ boss, ★ đã chiêu mộ boss, ◈ đã có item của boss. Map đang treo có viền vàng và nhãn "Đang ở". Map khóa ghi điều kiện mở ("Hạ Usopp").
- Ải phụ xen ngay sau map mở ra nó, viền tím: tên, level, số đá sao thưởng, nút "Vào". Huy hiệu trên tab Thế giới là số lượt thắng còn lại hôm nay.

### 5.6 Thông tin map

`mockup/3-mapinfo-en.jpg`.

- Ảnh nền ngang 150px có sprite boss và một lính. Nhãn trạng thái ("▶ Đang đánh", "✓ Đã hạ", "🔒").
- Tên arc, số map, tên map.
- Lưới 4 ô số: boss và hệ, level boss, tỉ lệ chiêu mộ (hoặc "Đã có" nếu đã chiêu mộ), tỉ lệ rơi item.
- Skill boss: mỗi skill một dòng gồm tên, hệ, hồi chiêu, sức mạnh, mục tiêu; mô tả bên dưới. Có chỗ cho mechanic riêng của boss khi người dùng thiết kế.
- Rơi đồ: tên item, hiệu ứng, 4 bậc với mức tăng.
- Lính: chân dung, hệ, khoảng level, số lính mỗi màn.
- Lưới màn nhỏ 5 cột.
- Hai nút dính ở đáy: "Treo màn N" (màn cao nhất đã mở) và "Đánh boss" (khóa cho tới khi qua hết màn nhỏ).

### 5.7 Trận boss, ải phụ và thẻ kết quả

`mockup/4-boss-vi.jpg`, `mockup/5-recruit-en.jpg`.

- Trên cảnh: thẻ boss với tên, hệ, level, thanh máu to, đếm "Vòng 6/30", hiệu ứng đang dính.
- Cảnh: 5 nhân vật xếp so le bên trái, boss lớn bên phải, như `layout.ts` hiện làm.
- Dải đội giống tab Phiêu lưu.
- **Thắng và chiêu mộ được**: thẻ lớn kiểu "NEW" của Poke'Catch: sprite, hệ, loại sát thương, level, sao; phần thưởng (vàng, food, item rơi với màu bậc, map mới mở); nút "Thêm vào đội" và "Sang map mới ▶".
- **Thắng mà không chiêu mộ được**: thẻ nhỏ hơn, ghi "Không chiêu mộ được lần này (10%)" cùng phần thưởng.
- **Thua**: thẻ ghi boss còn bao nhiêu máu, cùng gợi ý khắc hệ như ở 5.4.
- Ải phụ dùng cùng giao diện trận boss. Thẻ kết quả ghi số đá sao và số lượt còn lại hôm nay.

### 5.8 Đội hình và chi tiết nhân vật

Chưa có mockup. **Đề xuất:**

- Đầu tab: 5 ô đội hình theo thứ tự ra sân, mỗi ô có sprite, hệ, level, sao, item. Đổi thứ tự bằng kéo thả, và giữ nút mũi tên cho người dùng bàn phím.
- Dưới: lưới roster 3 cột ở 400px, lọc theo hệ, sắp theo level. Chạm một nhân vật để thêm vào đội hoặc bỏ ra; chạm giữ hoặc nút ⓘ để mở chi tiết.
- Chi tiết nhân vật là bảng trượt, đầu bảng có sprite lớn, hệ, sao, level. Ba tab con:
  - **Chỉ số**: 6 chỉ số với thanh, nút −/+ có giữ để lặp, và ô nhập số điểm. Nút đặt lại.
  - **Skill**: thứ tự skill, kéo thả hoặc mũi tên. Skill khóa ghi level mở.
  - **Item và sao**: chọn item bằng lưới thẻ thay cho `select`; khung nâng sao ghi chi phí và mốc cốt truyện.
- Lên level: nút "+1" và nút "Tối đa", lên nhiều cấp nhất mà vàng và food cho phép, trong giới hạn level. Nút "Tối đa" chỉ gọi lặp lại hàm lên level hiện có trong core.

### 5.9 Item

Chưa có mockup. **Đề xuất:**

- Lưới thẻ item, viền theo màu bậc, chân dung nhân vật đang đeo ở góc.
- Lọc theo bậc, theo "đang đeo" hoặc "chưa đeo".
- Phân rã: chọn nhiều item rồi bấm một nút. **Luôn hỏi xác nhận**, ghi tổng bụi nhận được. Item đang đeo hoặc bậc Huyền thoại cần xác nhận thêm một lần.
- Đổi bụi: lưới item đổi được thay cho `select`, kèm số bụi hiện có trên 50.

### 5.10 Thưởng offline, thông báo, cài đặt

- Thưởng offline giữ dạng hộp thoại giữa màn hình, theo phong cách mới: thời gian vắng, số trận, vàng, food, dòng "Tối đa 8 giờ" khi chạm trần. Cộng tài nguyên khi người chơi bấm nhận, hoặc đổi nhãn nút thành "OK".
- Sự kiện nhỏ (rơi item ở màn nhỏ nếu sau này có, mở map, lên level) hiện ở dòng tin. Chiêu mộ và kết quả boss dùng thẻ ở 5.7.
- Cài đặt (nút ⚙): ngôn ngữ, tốc độ phát lại mặc định, giảm chuyển động, xuất và nhập file lưu (nếu session chính làm), tín dụng (`CREDITS.md`).
- Có thể đổi màu nhấn và ảnh nền theo World để mỗi World có chút bản sắc (ý của phương án C), mà vẫn giữ khung pixel chung.

### 5.11 Hai ngôn ngữ

- Mọi chuỗi mới đi qua bảng chuỗi `en` và `vi` trong `src/i18n/`.
- Tiếng Việt thường dài hơn tiếng Anh 10 đến 30%. Mockup cho thấy các nhãn ngắn đều vừa ở 400px: "Phiêu lưu", "Thế giới", "Đội hình", "Item"; "Thám báo Mèo Đen" vừa nhãn trên đầu sprite.
- Nhãn nút trên thanh dưới tối đa khoảng 10 ký tự. Nút trong thẻ không cố định chiều rộng.
- Rút gọn số dùng K và M ở cả hai ngôn ngữ (161K, 1,2M). Dấu thập phân và dấu nhóm theo ngôn ngữ, như hàm `n` hiện có.
- Font pixel phải có dấu tiếng Việt (xem 5.1).

### 5.12 Truy cập và hiệu năng

- Vùng chạm tối thiểu 44 × 44px.
- Nhãn hệ luôn có chữ, không chỉ màu.
- Tôn trọng `prefers-reduced-motion`: tắt rung cảnh và số bay, giữ khung chữ.
- Khi tab Phiêu lưu bị ẩn ở điện thoại, hoặc trình duyệt chuyển tab, không vẽ canvas. Vòng treo máy vẫn mô phỏng và ghi file lưu.

## 6. Danh sách việc cho session chính

**Tiến độ ngày 12/11/2026.** Đã làm bước "Làm ngay" và các bước 1 đến 5, 7 đến 12. Bước 6 làm một phần. Bước 10 và 11 theo bản **Đề xuất** 5.8 và 5.9, chờ người dùng duyệt.

- Vòng treo máy nằm ở `src/ui/adventure.tsx`. Khi phát lại chậm hơn nhịp 30 giây, trận kế tiếp chờ phát lại xong (cách đơn giản hơn; nhịp chỉ có thể chậm đi, không nhanh lên). Màn đang treo không lưu vào file lưu; mở lại game thì treo ở map đầu tiên còn boss, tại màn cao nhất đã mở.
- Bước 6 đã có: nhãn tên và thanh máu ở độ cao cố định trên đầu, số sát thương bay từ thân, chữ ×2 và ×0.5, chí mạng màu vàng, tốc độ phát lại, dừng vẽ khi tab bị ẩn, nền trời biển cát. Chưa có: nhãn hệ cạnh tên trong cảnh, ảnh nền theo arc (bước 13).
- Font Tiny5: bộ latin và latin-ext lấy từ gói npm `@fontsource/tiny5`; gói này thiếu các chữ có dấu thanh tiếng Việt. Bộ `vietnamese` (Tiny5 v4 trên Google Fonts, 2,7 KB) được tải về `src/ui/fonts/` ngày 12/11/2026 với sự cho phép của người dùng, khai báo `@font-face` đầu `src/ui/styles.css`. Đã kiểm tra: ệ, ữ, ặ, ơ, ư hiện bằng nét Tiny5.

Người dùng duyệt mockup ngày 12/11/2026. Bước 10 và 11 làm theo 5.8 và 5.9, hai mục vẫn là **Đề xuất**: làm xong thì chụp màn hình cho người dùng duyệt. Xếp theo thứ tự nên làm, trừ việc "Làm ngay" bên dưới. Mọi chuỗi mới cần khóa `en` và `vi`. Sau mỗi bước, chụp màn hình ở 400px bằng cả hai ngôn ngữ, và ở 1280px khi đụng bố cục máy tính.

**Làm ngay, trước bước 1:** hỏi xác nhận trước khi phân rã item trong `src/ui/screens/ItemsScreen.tsx`. Hiện bấm một lần là mất item, kể cả item Huyền thoại đang đeo. Phần còn lại của túi đồ làm ở bước 11.

1. **Vòng treo máy ở mức ứng dụng.** Tạo `src/ui/adventure.tsx` (provider hoặc hook) giữ mục tiêu hiện tại (màn nhỏ hoặc boss hoặc ải phụ), tự lặp, tự đi tiếp, hàng đợi phát lại, số trận thắng, vàng mỗi giờ. Chuyển phần `start`, lặp và tự đi tiếp ra khỏi `src/ui/screens/BattleScreen.tsx`. Provider không bị gỡ khi đổi tab. Kết quả vẫn ghi vào file lưu ngay khi mô phỏng xong, như hiện tại.
   - **Nhịp cố định** (người dùng chọn): màn nhỏ chạy mỗi `3600 / offline.battlesPerHour` giây, tức 30 giây với `balance.json` hiện tại. Đọc từ cấu hình cân bằng, không đặt hằng số trong code. Tốc độ phát lại không đổi nhịp này. Phát lại xong sớm thì chờ tới mốc kế tiếp; phát lại chậm hơn nhịp (×1 với trận dài) thì trận kế tiếp chờ phát lại xong, hoặc bỏ qua phần còn lại. Session chính chọn cách nào đơn giản hơn và ghi lại.
   - Thời gian thật lấy ở `src/ui/`, không gọi `Date.now()` trong `src/core/`.
   - **Khi thua** (người dùng chọn): dừng lặp, hiện "Thử lại" và "Về màn trước". Không tự lùi màn.
2. **Giao diện tối pixel.** Viết lại biến trong `src/ui/styles.css` theo 5.1: màu nền, khung, nút, 7 màu hệ, 4 màu bậc item. Giữ tên các biến mà `src/ui/sceneColors.ts` đọc cho canvas. Bỏ nhánh `prefers-color-scheme` (chỉ giao diện tối). Thêm file font **Tiny5** tự chứa (bộ latin, latin-ext, vietnamese), khai báo `@font-face`, ghi giấy phép OFL vào `CREDITS.md`. Rút gọn số dùng K và M ở cả hai ngôn ngữ.
3. **Khung ứng dụng.** Viết lại `src/ui/App.tsx`: thanh trên dính, dòng tin, thanh dưới 4 tab ở dưới 720px, thanh bên ở 720 đến 1099px, 3 cột từ 1100px. Chuyển ô chọn ngôn ngữ vào hộp thoại cài đặt. Trạng thái màn đổi thành `tab` cộng ngăn xếp bảng trượt (`worldSheet`, `mapInfo`, `character`, `result`). Nút quay lại của trình duyệt đóng bảng trên cùng.
4. **Thành phần sprite tĩnh.** Tạo `src/ui/SpriteFrame.tsx` cắt một khung từ atlas theo `sprite.json` (khung `idle` đầu tiên hoặc `portrait`), phóng theo bội số, có hình thay thế khi nhân vật chưa có sprite. Dùng cho chân dung ở mọi màn.
5. **Tab Phiêu lưu.** Thay `BattleScreen.tsx` bằng `src/ui/screens/AdventureScreen.tsx` theo 5.4: dải màn, cảnh, góc số trận và tốc độ, khung chữ, dải đội 5 ô, hai thẻ treo máy, thẻ map, "Ở đây có" với gợi ý khắc hệ, nhật ký thu gọn. Thêm báo "Đang tải" khi PixiJS chưa sẵn sàng.
6. **Cảnh trận** (`src/render/BattleScene.ts`, `src/render/layout.ts`): nhãn tên và thanh máu ở độ cao cố định; số sát thương bay từ thân, không đè nhãn; chữ khắc hệ và chí mạng; khung chữ (vẽ trong Pixi hoặc HTML phủ lên canvas); nền theo arc (tạm dùng dải màu trời, biển, cát như mockup cho tới khi có ảnh nền); hỗ trợ tốc độ phát lại; dừng vẽ khi bị ẩn.
7. **Bảng Thế giới.** Thay `MapListScreen.tsx` bằng bảng trượt theo 5.5. Thêm trường arc (tên `en` và `vi`) vào schema map trong `src/content/schema.ts` và vào `packs/onepiece/worlds.ts`; gói placeholder dùng một arc chung. Ải phụ xen sau map mở ra nó. Huy hiệu lượt ải phụ trên tab.
8. **Thông tin map.** Viết lại `MapInfoScreen.tsx` thành bảng trượt theo 5.6, với hai nút dính ở đáy.
9. **Trận boss, ải phụ, thẻ kết quả.** Chế độ boss trong tab Phiêu lưu, thẻ boss trên cảnh, thẻ thắng có chiêu mộ, thắng không chiêu mộ, thua (5.7).
10. **Đội hình và nhân vật.** Viết lại `TeamScreen.tsx` và `CharacterScreen.tsx` theo 5.8, gồm nút lên level "Tối đa" và ô nhập điểm.
11. **Item.** Viết lại `ItemsScreen.tsx` theo 5.9. Thêm hộp xác nhận trước khi phân rã. Việc này nên làm sớm, kể cả trước bước 2, vì hiện có thể lỡ tay phá item Huyền thoại đang đeo.
12. **Thưởng offline.** Đổi kiểu hộp thoại trong `App.tsx`. Sửa thời điểm cộng tài nguyên hoặc nhãn nút (5.10).
13. **Ảnh nền map.** Việc cho session sprite ("Tìm sprite và thiết kế skill theo hoạt ảnh"): tìm ảnh nền GBA hoặc MUGEN cho 4 arc, hoặc vẽ ảnh nền pixel đơn giản, ghi nguồn như sprite.

## 7. Câu hỏi đã trả lời

Người dùng trả lời ngày 12/11/2026:

1. **Tốc độ phát lại có làm tăng thu nhập không?** Không. Treo máy chạy theo nhịp cố định khớp thưởng offline (1 trận mỗi 30 giây). Tốc độ chỉ đổi cách xem. Lý do: hiện mỗi trận mới bắt đầu ngay sau khi phát lại xong, nên ×4 sẽ cho thu nhập gấp khoảng 4 lần khi đang mở game.
2. **Thua ở màn nhỏ:** dừng lặp, hiện "Thử lại" và "Về màn trước". Không tự lùi màn.
3. **Giao diện sáng:** không có. Chỉ một giao diện tối.
4. **Rút gọn số:** K và M ở cả hai ngôn ngữ. Người dùng không chọn khác khi được hỏi.
5. **Font pixel:** Tiny5.

Còn lại cần người dùng duyệt sau khi làm: bố cục 5.8 (đội hình, nhân vật) và 5.9 (item).
