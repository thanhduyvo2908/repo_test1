# Nguồn sprite cho World 1

Tình trạng ngày 11/11/2026. Người dùng tự tải file; Claude chỉ tìm và ghi nguồn. Tải xong thì giải nén vào `assets-raw/<id>/`. Thư mục này đã nằm trong `.gitignore`.

## Hai loại nguồn

1. **Nhân vật MUGEN** (`.def`, `.sff`, `.air`, `.cmd`, `.cns`). Đây là định dạng mà `npm run mugen:preview` đọc được.
2. **Sprite sheet rip từ game One Piece trên GBA** (Bandai, 2005, thể loại beat 'em up) ở [Sprite Database](https://spritedatabase.net/game/1089). Mỗi nhân vật là một file GIF hoặc PNG gồm mọi khung hình, không có dữ liệu hoạt ảnh. Tool trong repo chưa đọc được định dạng này: cần thêm một script cắt sheet thành từng khung.

Bộ GBA có đủ cả 6 boss còn thiếu, các loại lính, và cả băng Mũ Rơm, Buggy, Kuro, cùng một nét vẽ. Điều kiện của trang: dùng riêng tư hoặc phi thương mại. Trên sheet ghi người rip là "Grim" và yêu cầu ghi công khi dùng. Sheet NPC do Harsh29 rip.

## Boss còn thiếu

| Boss | Nguồn tốt nhất | Link | Tác giả / người rip | Điều kiện dùng lại | Ghi chú |
| --- | --- | --- | --- | --- | --- |
| Alvida | GBA rip | [Alvida (béo)](https://spritedatabase.net/file/4043), [Alvida (gầy)](https://spritedatabase.net/file/4044) | Grim | Phi thương mại, ghi công | Có bản MUGEN của Walruslui trên [AK1](https://www.andersonkenya1.net/files/file/12158-alvida/), nhưng đánh giá trên trang nói nhân vật chỉ là một hình tĩnh, không có hoạt ảnh. Không dùng được. |
| Morgan | GBA rip | [Axe-Hand Morgan](https://spritedatabase.net/file/4046) | Grim | Phi thương mại, ghi công | Không tìm thấy bản MUGEN. |
| Cabaji | GBA rip | [Cabaji](https://spritedatabase.net/file/4047) | Grim | Phi thương mại, ghi công | Không tìm thấy bản MUGEN. |
| Jango | GBA rip | [Jango](https://spritedatabase.net/file/4052) | Grim | Phi thương mại, ghi công | Game MUGEN "Grand Line Bout" có Jango, nhưng diễn đàn của game trên Tapatalk không mở được từ trình duyệt của Claude. |
| Gin | GBA rip | [Gin](https://spritedatabase.net/file/4055) | Grim | Phi thương mại, ghi công | Không tìm thấy bản MUGEN. |
| Don Krieg | MUGEN hoặc GBA rip | MUGEN: [Don Krieg của edd13](https://mugenfreeforall.com/topic/26450-don-krieg-by-edd13-released-dec-27-2015/) (link tải trong bài: MediaFire `DonKrieg.zip`). GBA: [Don Krieg](https://spritedatabase.net/file/4056) | MUGEN: edd13, sprite gốc của vbc. GBA: Grim | MUGEN: bài đăng không ghi điều kiện; xem readme sau khi tải. GBA: phi thương mại, ghi công | Sheet GBA có: đứng, đi, khiên bắn đạn, bom nổ, đấm, đòn quét bằng áo choàng, gục, ảnh chân dung. Đủ cho 4 skill. |

## Lính

| Bộ lính | Nguồn | Link | Ghi chú |
| --- | --- | --- | --- |
| Hải tặc | GBA rip | [Pirate (sword)](https://spritedatabase.net/file/4034), [Pirate (gun)](https://spritedatabase.net/file/4035), [Pirate (knife)](https://spritedatabase.net/file/4036), [Pirate (bomb)](https://spritedatabase.net/file/4037) | 4 kiểu vũ khí. Đổi bảng màu để làm hải tặc Alvida, Buggy, Mèo Đen, Krieg. |
| Lính hải quân | GBA rip | [Marine Swordsman](https://spritedatabase.net/file/4038), [Marine Rifleman](https://spritedatabase.net/file/4039) | Đổi màu để làm sĩ quan. |
| Đầu bếp | GBA rip, thiếu | [NPC's](https://spritedatabase.net/file/4061) | Sheet NPC có 2 đầu bếp Baratie nhưng chỉ có 2 khung đứng yên, không có đòn đánh. Phương án: đổi màu hải tặc thành đầu bếp, hoặc dùng sheet NPC cho đứng yên và mượn đòn của hải tặc. |
| Lính có tên | GBA rip | [Helmeppo](https://spritedatabase.net/file/4045), [Mohji & Richie](https://spritedatabase.net/file/4048), [Nyaban Brothers (Sham, Buchi)](https://spritedatabase.net/file/4051), [Pearl](https://spritedatabase.net/file/4054) | Khớp danh sách lính mạnh đề xuất trong `docs/world-1.md`. Không có Fullbody. |

## Nhân vật đã có sprite từ trước

Luffy, Zoro, Nami, Sanji (JUS gốc và Gigant Battle), Buggy, Usopp, Kuro (Gigant Battle). Người dùng đã tìm các bộ này nhưng chưa tải vào `assets-raw/`. Bộ GBA cũng có sheet của cả 7 nhân vật này: [Luffy](https://spritedatabase.net/file/4029), [Zoro](https://spritedatabase.net/file/4030), [Nami](https://spritedatabase.net/file/4031), [Usopp](https://spritedatabase.net/file/4032), [Sanji](https://spritedatabase.net/file/4033), [Buggy](https://spritedatabase.net/file/4049), [Kuro](https://spritedatabase.net/file/4053).

## Quyết định của người dùng (11/11/2026)

Ưu tiên MUGEN; nhân vật nào thiếu bản MUGEN dùng được thì lấy sheet GBA đắp vào, đổi tỉ lệ và bảng màu cho khớp. Theo đó:

| Nhân vật | Nguồn chọn | Thư mục `assets-raw/` |
| --- | --- | --- |
| Luffy, Zoro, Nami, Sanji | MUGEN: JUS gốc hoặc Gigant Battle, chọn sau khi so sánh | `luffy-jus`, `luffy-gb`, ... |
| Buggy, Usopp, Kuro | MUGEN: Gigant Battle | `buggy-gb`, `usopp-gb`, `kuro-gb` |
| Don Krieg | MUGEN của edd13. Nếu bản này hỏng hoặc thiếu đòn, dùng GBA | `krieg` |
| Alvida, Morgan, Cabaji, Jango, Gin | GBA | `alvida-gba`, `morgan-gba`, `cabaji-gba`, `jango-gba`, `gin-gba` |
| Hải tặc, lính hải quân, đầu bếp | GBA | `pirate-gba`, `marine-gba`, `npc-gba` |

Sheet GBA xem bằng `npm run sheet:preview -- <id>`.

## Nguồn đã thử mà không vào được

- Mugenarchive: Cloudflare chặn. Claude không vượt qua bước xác minh.
- Diễn đàn One Piece MUGEN "Grand Line Bout" trên Tapatalk: trình duyệt của Claude không mở được.
- MUGEN Database (Fandom): không có trang cho các boss này.
