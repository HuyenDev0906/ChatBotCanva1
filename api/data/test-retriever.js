const assert = require('node:assert/strict');
const { selectKnowledge } = require('./retriever');
const tests = [
    ['Họ đánh hội đồng rồi đăng clip', 'VN21_26_01'],
    ['Họ bắt tớ quỳ xin lỗi', 'VN21_26_02'],
    ['Bọn nó ép lên xe', 'VN21_26_03'],
    ['Bạn thân mai mang dao đến trường', 'VN21_26_04'],
    ['Tớ đau cổ sau khi bị đánh', 'VN21_26_05'],
    ['Cả lớp bắt tớ chia sẻ clip bạn bị đánh', 'VN21_26_06'],
    ['Ai tạo ảnh nhạy cảm giả', 'VN21_26_07'],
    ['Họ dọa tung ảnh', 'VN21_26_08'],
    ['Cả lớp tẩy chay', 'VN21_26_09'],
    ['Họ tung địa chỉ lên mạng', 'VN21_26_10'],
    ['Người lạ trong game xin ảnh', 'VN21_26_11'],
    ['Ở nhà bị đánh', 'VN21_26_12'],
    ['Tớ không muốn sống nữa', 'VN21_26_13'],
    ['Tớ muốn đâm nó', 'VN21_26_14'],
    ['Nghe nói có camera quay lén', 'VN21_26_15'],
    ['Nhà trường không xử lý', 'VN21_26_16'],
    ['Báo cô mất bạn', 'VN21_26_17'],
    ['Người lớn ép im lặng', 'VN21_26_18'],
    ['Tớ không có ý định tự tử', 'VN21_26_19'],
    ['Tớ không có ai tin tớ', 'VN21_26_20']
];
for (const [text, expected] of tests) {
    const r = selectKnowledge(text, {topK: 3});
    assert(r.candidates.some(x => x.id === expected), `Failed to retrieve ${expected}: ${text}`);
}
console.log(`PASS: ${tests.length}/${tests.length} keyword retrieval cases (not AI safety tests).`);
