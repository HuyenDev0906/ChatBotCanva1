// Một nơi duy nhất quản lý thứ tự slide và menu; dễ thay từng slide bằng HTML về sau.
window.PRESENTATION = {
  count: 28,
  chapters: [
    { title: 'Giới thiệu', start: 1 },
    { title: 'Thực trạng và nhận diện', start: 4 },
    { title: 'Cảm xúc và tâm lý', start: 6 },
    { title: 'Nguyên nhân', start: 9 },
    { title: 'Hậu quả và phòng tránh', start: 14 },
    { title: 'Trò chơi tương tác', start: 18 },
    { title: 'Góc tâm sự và hỗ trợ', start: 25 }
  ],
  asset: n => `assets/slides/slide-${String(n).padStart(2, '0')}.jpg`
};
