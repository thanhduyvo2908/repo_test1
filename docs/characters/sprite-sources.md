# Nguồn sprite cho World 1

Tình trạng ngày 11/11/2026. Mọi nguồn sprite nằm trong `assets-raw/<id>/`; thư mục này đã nằm trong `.gitignore`. Người rip và điều kiện dùng lại của từng sheet ghi ở `CREDITS.md`.

## Hai loại nguồn

1. **Nhân vật MUGEN** (`.def`, `.sff`, `.air`, `.cmd`, `.cns`). Xem bằng `npm run mugen:preview -- <id>`. Người dùng tự tải các bộ này, vì chúng là file nén trên MediaFire hoặc Mega.
2. **Sprite sheet rip từ game One Piece trên GBA** (Bandai, 2005, thể loại beat 'em up) ở [Sprite Database](https://spritedatabase.net/game/1089). Mỗi nhân vật là một file GIF hoặc PNG gồm mọi khung hình, không có dữ liệu hoạt ảnh. Xem bằng `npm run sheet:preview -- <id>`: script cắt sheet thành từng khung đánh số. Hoạt ảnh khai báo trong `tools/sheets/<id>.json`.

Trang Sprite Database chỉ cho dùng riêng tư hoặc phi thương mại. Mỗi sheet do một người rip khác nhau (Grim, harsh29, Croix, WingedDestiny, oO/Kodama). Phần lớn yêu cầu ghi công.

## Quyết định của người dùng

Ưu tiên MUGEN; nhân vật nào thiếu bản MUGEN dùng được thì lấy sheet GBA đắp vào, đổi tỉ lệ và bảng màu cho khớp.

| Nhân vật | Nguồn chọn | Thư mục `assets-raw/` | Tình trạng |
| --- | --- | --- | --- |
| Luffy, Zoro, Nami, Sanji | MUGEN: JUS gốc hoặc Gigant Battle, chọn sau khi so sánh | `luffy-jus`, `luffy-gb`, ... | Chưa tải |
| Buggy, Usopp, Kuro | MUGEN: Gigant Battle | `buggy-gb`, `usopp-gb`, `kuro-gb` | Chưa tải |
| Don Krieg | MUGEN của edd13; nếu bản này hỏng hoặc thiếu đòn thì dùng GBA | `krieg`, dự phòng `krieg-gba` | Bản MUGEN chưa tải; sheet GBA đã tải |
| Alvida | GBA | `alvida-gba` | Đã tải 2 sheet |
| Morgan | GBA | `morgan-gba` | Đã tải |
| Cabaji | GBA | `cabaji-gba` | Đã tải, thiếu hoạt ảnh (xem dưới) |
| Jango | GBA | `jango-gba` | Đã tải |
| Gin | GBA | `gin-gba` | Đã tải, thiếu ảnh chân dung |
| Hải tặc, lính hải quân, đầu bếp | GBA | `pirate-gba`, `marine-gba`, `npc-gba` | Đã tải |
| Helmeppo, Mohji và Richie, Sham và Buchi, Pearl | GBA | `helmeppo-gba`, `mohji-gba`, `nyaban-gba`, `pearl-gba` | Đã tải |

## Nội dung các sheet GBA đã tải

Số khung là kết quả của `sheet:preview` với gap mặc định 3px. Số này gồm cả dòng chữ ghi công trên sheet.

| Sheet | Khung | Có gì | Thiếu gì |
| --- | --- | --- | --- |
| Alvida (béo), `Alvida.gif` | 33 | Đứng, nhiều đòn vung chùy, đập đất tung bụi, trúng đòn, ngã lăn, icon chân dung nhỏ | Ảnh chân dung cỡ lớn |
| Alvida (gầy), `Alvida2.gif` | 25 | Màn mở đầu tung áo choàng, vung chùy, đập đất, gục, khung chân dung trên thanh máu | |
| Morgan, `Morgan.gif` | 60 | Đứng (mặc áo khoác và không áo), chém rìu có vệt sáng, bổ rìu xuống đất tung đá, phóng sóng hình trăng khuyết, trúng đòn, gục, ảnh chân dung lớn | |
| Cabaji, `Cabaji.gif` | 10 | Đạp xe một bánh, chém kiếm có vệt lửa | Đứng yên, trúng đòn, gục, chân dung. Dòng chữ trên sheet ghi đây là toàn bộ hoạt ảnh của Cabaji trong game |
| Jango, `Django.gif` | 58 | Đứng, đi kiểu moonwalk, đung đưa vòng thôi miên, ngủ (có bóng chữ Zzz), ném vòng chakram, gục, ảnh chân dung | |
| Gin, `Ghin.gif` | 61 | Đứng, xoay tonfa bi sắt, quét, ném bi, nhảy đập, trúng đòn, gục | Ảnh chân dung |
| Don Krieg, `DonKrieg.gif` | 88 | Đứng, đi, khiên bắn đạn, bom nổ, đấm, đòn quét áo choàng, gục, ảnh chân dung | |
| Hải tặc kiếm, `SwdPirates.gif` | 54 | Hai kiểu (khăn xanh dương, khăn xanh lá), mỗi kiểu có bảng màu thay thế; đứng, đi, chém, trúng đòn, gục | |
| Hải tặc súng, `GunPirate.gif` | 26 | Đứng, bắn, trúng đòn, gục, bảng màu thay thế | |
| Hải tặc dao, `KnifePirate.gif` | 53 | Ném dao, tung hứng, đi, trúng đòn; nhóm "Jugglers" và "Walkers" kèm cờ băng | Hợp làm nghệ sĩ xiếc của Buggy |
| Hải tặc bom, `BombPirate.gif` | 29 | Đu dây, ném bom, chuỗi nổ, gục | |
| Lính hải quân kiếm, `MarineSword.gif` | 13 | Đứng, chém có vệt sáng, trúng đòn, gục | |
| Lính hải quân súng, `MarineRifle.gif` | 21 | Đứng, bắn, đạn nổ, trúng đòn, gục | |
| NPC, `NPCs.png` | 59 | Dân làng, 2 đầu bếp Baratie | Đầu bếp chỉ có 2 khung đứng yên |
| Helmeppo, `Helmeppo.gif` | 28 | Đứng, hoảng sợ, trúng đòn, gục | Đòn đánh |
| Mohji và Richie, `MohjiandRichie.gif` | 49 | Sư tử Richie: gầm, vồ, cào, gục. Mohji: ra lệnh, trúng đòn, gục, chân dung. Có kèm một hình nền sân khấu (thành 1 khung lớn) | |
| Sham và Buchi, `NyabanBros.gif` | 16 | Buchi: dậm đất, nhảy. Sham: cào, trúng đòn | |
| Pearl, `Pearl.gif` | 16 | Đứng sau khiên, khiên bốc lửa, cầu lửa, ngã | |

## Vấn đề cần người dùng quyết

- **Cabaji không đủ hoạt ảnh** cho một boss có 3 skill. Phương án: (a) dùng 10 khung có sẵn, ghép đòn đánh thường, S1, S2, S3 từ cùng một chuỗi chém, còn trúng đòn và gục thì dùng hiệu ứng nháy hoặc đổ ngã bằng code; (b) tìm thêm nguồn khác cho Cabaji.
- **Alvida dùng bản béo hay gầy.** Ở map 1, lúc đánh Luffy, Alvida đang béo; bản gầy xuất hiện sau khi ăn trái ác quỷ. Đề xuất: boss map 1 dùng bản béo.
- **Gin không có ảnh chân dung.** Phương án: cắt một khung đứng yên và phóng to phần đầu làm chân dung. Đây là chỉnh sprite có sẵn, không vẽ mới.
- **Đầu bếp Baratie** chỉ có 2 khung đứng yên. Phương án: đổi bảng màu hải tặc dao hoặc hải tặc kiếm thành đầu bếp.

## One Piece Mugen V14 (Dark Night Mugen)

Một game MUGEN 1.1 trọn bộ, phát hành tháng 1/2025, 195 nhân vật tính cả các dạng biến hình. File RAR 7 GB, giải nén ra 12 GB, chỉ có trên MediaFire: [trang giới thiệu ở jfmugen.com](https://jfmugen.com/one-piece-mugen/). Người dùng tự tải.

- **Có trong danh sách và liên quan World 1:** Luffy, Zoro, Nami, Usopp, Sanji, Buggy, Kuro, Morgan, Don Krieg. Riêng Morgan là bản MUGEN đầu tiên tìm được.
- **Không có:** Alvida, Cabaji, Jango, Gin. Bốn boss này vẫn dùng GBA.
- **Rủi ro:** trang giới thiệu không ghi tác giả của từng nhân vật, cũng không ghi điều kiện dùng lại. Game này gom nhân vật từ nhiều người làm khác nhau, nên nét vẽ và cỡ sprite có thể lệch nhau. Phải đọc dòng `author` trong `.def` và readme của từng nhân vật sau khi giải nén, rồi mới ghi được vào `CREDITS.md`.
- **Cách dùng:** giải nén, chỉ chép thư mục của các nhân vật cần trong `chars/` vào `assets-raw/op14-<tên>/`, ví dụ `assets-raw/op14-morgan/`. Sau đó chạy `npm run mugen:preview -- op14-morgan` để so sánh với bộ JUS, Gigant Battle và GBA.

## Nguồn khác đã tìm

- Don Krieg bản MUGEN: [Don Krieg của edd13](https://mugenfreeforall.com/topic/26450-don-krieg-by-edd13-released-dec-27-2015/), sprite gốc của vbc, link tải MediaFire trong bài. Người dùng tự tải.
- Alvida bản MUGEN của Walruslui trên [AK1](https://www.andersonkenya1.net/files/file/12158-alvida/): đánh giá trên trang nói nhân vật chỉ là một hình tĩnh. Không dùng.
- Bộ GBA còn có sheet của các nhân vật đã có MUGEN, dùng làm dự phòng: [Luffy](https://spritedatabase.net/file/4029), [Zoro](https://spritedatabase.net/file/4030), [Nami](https://spritedatabase.net/file/4031), [Usopp](https://spritedatabase.net/file/4032), [Sanji](https://spritedatabase.net/file/4033), [Buggy](https://spritedatabase.net/file/4049), [Kuro](https://spritedatabase.net/file/4053).

## Nguồn đã thử mà không vào được

- Mugenarchive: Cloudflare chặn. Claude không vượt qua bước xác minh.
- Diễn đàn One Piece MUGEN "Grand Line Bout" trên Tapatalk: trình duyệt của Claude không mở được. Game này có Jango, Kuro, Don Krieg, Sham và Buchi.
- MUGEN Database (Fandom): không có trang cho các boss này.
