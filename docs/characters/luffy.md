# Luffy

Bản thiết kế nhân vật. Luật chung ở `CLAUDE.md`, bối cảnh World 1 ở `docs/world-1.md`.

Nhãn **Đề xuất** đánh dấu phần chưa được người dùng duyệt. Theo `CLAUDE.md`, skill được thiết kế dựa trên hoạt ảnh có sẵn trong sprite; Claude đề xuất, người dùng duyệt bản cuối.

## Tổng quan

| Mục | Giá trị |
| --- | --- |
| Tên (EN / VI) | Luffy / Luffy |
| Nguồn | Nhân vật khởi đầu |
| Hệ | Thổ (`earth`) |
| Loại sát thương | Vật lý |
| Item | Straw Hat / Mũ rơm |
| Sprite | Có: JUS gốc, Gigant Battle. Chưa tải về `assets-raw/`. Xem `sprite-sources.md` |
| Mốc lên 2 sao | **Đề xuất:** hạ boss map 12 (Don Krieg) |

**Đề xuất** chất nhân vật: đấu sĩ tự trụ. Sát thương vừa phải, hồi máu bằng đòn đánh, chịu đòn vật lý tốt nhờ thân cao su. Lý do: người chơi có thể chỉ có Luffy suốt map 1 đến 3.

## Ràng buộc từ thiết kế World 1

- Người chơi có thể chỉ có Luffy trong nhiều map đầu. Zoro (map 2) chỉ có 10% chiêu mộ, Alvida (map 1) có 20%. Luffy phải tự đánh được trận boss của map 1 đến 3, dù trận boss là 5 đấu 1 và trong đội có thể chỉ có mình Luffy. Vì vậy Luffy cần tự trụ được, không chỉ có sát thương.
- Luffy chỉ có S1 cho tới level 20 (khoảng map 8), nên S1, đòn đánh thường và passive gánh gần hết World 1.
- Usopp (Mộc, map 7) khắc Luffy: Usopp đánh Luffy nhân 2, Luffy đánh Usopp nhân 0,5.
- Mũ rơm tăng sát thương vật lý cho skill hệ Thổ. Mọi đòn của Luffy dưới đây đều hệ Thổ, nên đều hưởng STAB và Mũ rơm.

## Base stat

**Đề xuất**, tổng 460. Lý do: Luffy là nhân vật khởi đầu, phải gánh đội một mình ở mấy map đầu, nên chỉ số đều. Công vật lý cao nhất vì đánh vật lý. HP khá vì thân cao su chịu đòn tốt. Công phép thấp vì không dùng tới.

| HP | Công vật lý | Thủ vật lý | Công phép | Thủ phép | Tốc độ | Tổng |
| --- | --- | --- | --- | --- | --- | --- |
| 90 | 100 | 75 | 40 | 70 | 85 | 460 |

Chỉ số thực tế, chưa cộng điểm tự nâng:

| Level | HP | Công vật lý | Thủ vật lý | Công phép | Thủ phép | Tốc độ |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 12 | 7 | 6 | 5 | 6 | 6 |
| 10 | 38 | 25 | 20 | 13 | 19 | 22 |
| 20 | 66 | 45 | 35 | 21 | 33 | 39 |
| 30 | 94 | 65 | 50 | 29 | 47 | 56 |

## Hoạt ảnh

Chờ sprite. Khi người dùng tải bộ JUS và Gigant Battle vào `assets-raw/luffy-jus/` và `assets-raw/luffy-gb/`, chạy `npm run mugen:preview -- luffy-jus` (và `luffy-gb`), mở `tools/out/preview/<id>/index.html`, rồi điền bảng này. Cột "Cần tìm" là đòn mà bản thiết kế skill bên dưới giả định; nếu bộ sprite không có đòn đó, đổi skill theo đòn có sẵn.

| Ô | Cần tìm | Bộ sprite | Action | State / lệnh | Ghi chú |
| --- | --- | --- | --- | --- | --- |
| Đứng yên | Thế đứng thủ | Chờ | Thường là 0 | | |
| Đòn đánh thường | Cú đấm hoặc đá nhanh | Chờ | | | |
| S1 | Gomu Gomu no Pistol: tay vươn dài đấm thẳng | Chờ | | | |
| S2 | Gomu Gomu no Fusen: thân phồng thành bóng | Chờ | | | Nếu không có Fusen: dùng thế thủ, đòn đỡ, hoặc đòn Gatling và đổi S2 sang tấn công |
| S3 | Gomu Gomu no Bazooka: hai tay đẩy mạnh | Chờ | | | |
| S4 | Thuộc World sau | | | | |
| Trúng đòn | | Chờ | Thường là 5000 | | |
| Gục | | Chờ | Thường là 5140 hoặc 5150 | | |
| Chân dung | | Chờ | Sprite 9000,0 hoặc 9000,1 | | |

Tránh chọn đòn bị trang xem trước gắn nhãn ĐÒN VẬT hoặc HIỆU ỨNG FIGHTFX.

## Passive

**Đề xuất.** Thân cao su (Rubber Body). Nhóm: bảo vệ và hồi phục.

| Mục | Giá trị |
| --- | --- |
| Tên (EN / VI) | Rubber Body / Thân cao su |
| Mô tả EN | Takes 20% less physical damage. The first time HP drops below 50% in a battle, restores 20% of max HP. |
| Mô tả VI | Nhận ít hơn 20% sát thương vật lý. Lần đầu HP xuống dưới 50% trong một trận, hồi 20% HP tối đa. |
| Hiệu ứng 1 | Giảm sát thương vật lý nhận vào 20%, cố định suốt trận. Vào công thức ở hệ số "hiệu ứng khác". |
| Hiệu ứng 2 | Hồi 20% HP tối đa, 1 lần mỗi trận. Ở màn nhỏ, một trận là cả màn. |

Lý do: phần lớn boss và lính East Blue đánh vật lý (chùy, rìu, kiếm, tonfa). Trong truyện, chùy sắt của Alvida không làm Luffy đau, nên giảm sát thương vật lý vừa hợp truyện vừa giúp Luffy trụ ở map 1 đến 3. Nami (map 4) và Usopp (map 7) là chỗ thân cao su ít tác dụng hơn.

## Đòn đánh thường

**Đề xuất.**

| Mục | Giá trị |
| --- | --- |
| Tên (EN / VI) | Punch / Đấm |
| Hệ | Thổ |
| Power | 40 |
| Tăng theo | Công vật lý × 1,0 |
| Mục tiêu | 1 địch |
| Hiệu ứng | Không |

## Skill

**Đề xuất** cho cả bảng. Mỗi skill hệ Thổ, sát thương vật lý.

| Ô | Mở ở level | Kiểu dùng | Thiết kế |
| --- | --- | --- | --- |
| S1 | 1 | Hồi chiêu 2 vòng | Gomu Gomu no Pistol |
| S2 | 20 | Hồi chiêu 4 vòng | Gomu Gomu no Fusen |
| S3 | 30 | 1 lần mỗi trận | Gomu Gomu no Bazooka |
| S4 | 50 | 1 lần mỗi trận | Thuộc World sau |

### S1: Gomu Gomu no Pistol

| Mục | Giá trị |
| --- | --- |
| Tên (EN / VI) | Gum-Gum Pistol / Gomu Gomu Pistol |
| Mô tả EN | Stretches an arm for a long-range punch. Restores HP equal to 30% of the damage dealt. |
| Mô tả VI | Vươn tay đấm từ xa. Hồi HP bằng 30% sát thương gây ra. |
| Power | 80 |
| Tăng theo | Công vật lý × 1,0 |
| Mục tiêu | 1 địch |
| Hồi chiêu | 2 vòng. Với hồi chiêu giảm cuối mỗi lượt, Luffy dùng Pistol cách một lượt, xen với đòn đánh thường. |
| Hiệu ứng | Hồi máu theo sát thương gây ra, 30%. Nhóm: bảo vệ và hồi phục. |

Ví dụ ở level 10, đánh mục tiêu có thủ vật lý 20 (base 75): Pistol gây khoảng 17 đến 21 sát thương và hồi 5 đến 6 HP, tức khoảng 15% HP tối đa của Luffy. Đòn đánh thường gây khoảng 10 đến 12. Con số chỉ để hình dung; cân bằng thật làm bằng `npm run sim`.

### S2: Gomu Gomu no Fusen

| Mục | Giá trị |
| --- | --- |
| Tên (EN / VI) | Gum-Gum Balloon / Gomu Gomu Fusen |
| Mô tả EN | Inflates into a balloon: gains a shield worth 25% of max HP and taunts all enemies for 2 rounds. |
| Mô tả VI | Phồng thân thành bóng: nhận khiên bằng 25% HP tối đa và khiêu khích mọi địch trong 2 vòng. |
| Power | 0, không gây sát thương |
| Tăng theo | HP tối đa × 0,25 cho lượng khiên |
| Mục tiêu | Bản thân |
| Hồi chiêu | 4 vòng |
| Hiệu ứng | Khiên 2 vòng; khiêu khích 2 vòng. Nhóm: bảo vệ và hồi phục. |

Lý do: từ level 20 người chơi đã có đội. Fusen biến Luffy thành người đỡ đòn cho đồng đội, mạnh nhất trong trận boss 5 đấu 1. Khiêu khích chỉ có tác dụng khi Luffy không đứng đầu đội hình, vì boss mặc định đánh người đứng đầu còn sống.

### S3: Gomu Gomu no Bazooka

| Mục | Giá trị |
| --- | --- |
| Tên (EN / VI) | Gum-Gum Bazooka / Gomu Gomu Bazooka |
| Mô tả EN | A two-handed palm strike. 30% chance to stun the target for 1 round. |
| Mô tả VI | Hai tay đẩy mạnh. 30% làm choáng mục tiêu 1 vòng. |
| Power | 150 |
| Tăng theo | Công vật lý × 1,0 |
| Mục tiêu | 1 địch |
| Hồi chiêu | Không, 1 lần mỗi trận |
| Hiệu ứng | Choáng 1 vòng, tỉ lệ 30%. Nhóm: khống chế. |

## Lên 2 sao

**Đề xuất.**

- Base stat cộng thêm: HP +5, công vật lý +5, thủ vật lý +5. Tổng 475.
- Passive: lần hồi máu khi HP dưới 50% tăng từ 20% lên 30% HP tối đa.
- S1 Pistol: Power 80 lên 90, hồi máu từ 30% lên 40% sát thương gây ra.
- S3 Bazooka: tỉ lệ choáng từ 30% lên 50%.
- Hiệu ứng mới: Pistol có 20% làm mục tiêu giảm 1 bậc thủ vật lý trong 2 vòng (nhóm tăng giảm chỉ số).

## Item: Mũ rơm

- Điều kiện: skill hệ Thổ, sát thương vật lý.
- Hiệu ứng: tăng sát thương. Thường 5%, Hiếm 10%, Sử thi 20%, Huyền thoại 30%.
- Không rơi từ boss. Người chơi nhận bản Huyền thoại khi hạ Don Krieg lần đầu.

## Câu hỏi cho người dùng

- Hút máu theo sát thương và giảm sát thương vật lý không có tên riêng trong 4 nhóm hiệu ứng đã chốt. Bản đề xuất xếp cả hai vào nhóm bảo vệ và hồi phục. Engine cần hỗ trợ hai kiểu này nếu người dùng duyệt.
- Có muốn Luffy là nhân vật đỡ đòn (Fusen khiêu khích) hay thuần sát thương? Nếu thuần sát thương, S2 đổi thành Gomu Gomu no Gatling.

## Tư liệu: chiêu của Luffy ở East Blue

Dùng khi đặt tên và chọn hoạt ảnh.

Gomu Gomu no Pistol, Whip, Rocket, Bazooka, Gatling, Balloon (Fusen), Stamp, Spear, Axe. Thân cao su miễn nhiễm đòn đánh cùn và đạn.
