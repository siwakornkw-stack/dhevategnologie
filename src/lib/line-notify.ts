interface BookingInfo {
  userName: string;
  fieldName: string;
  date: string;
  timeSlot: string;
}

async function sendLine(message: string) {
  const token = process.env.LINE_NOTIFY_TOKEN;
  if (!token || token.startsWith('your-')) return;

  try {
    const res = await fetch('https://notify-api.line.me/api/notify', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ message }),
    });
    if (!res.ok) console.error('[line-notify] send failed, status:', res.status);
  } catch (err) {
    console.error('[line-notify] send failed:', err);
  }
}

export async function notifyLineNewBooking(data: BookingInfo) {
  await sendLine(
    `\n📋 การจองใหม่!\nลูกค้า: ${data.userName}\nสนาม: ${data.fieldName}\nวันที่: ${data.date}\nเวลา: ${data.timeSlot} น.`,
  );
}

export async function notifyLineBookingStatus(status: 'APPROVED' | 'REJECTED', data: BookingInfo) {
  const icon = status === 'APPROVED' ? '✅' : '❌';
  const label = status === 'APPROVED' ? 'อนุมัติแล้ว' : 'ปฏิเสธแล้ว';
  await sendLine(
    `\n${icon} การจอง${label}\nลูกค้า: ${data.userName}\nสนาม: ${data.fieldName}\nวันที่: ${data.date}\nเวลา: ${data.timeSlot} น.`,
  );
}

export async function notifyLineBulkStatus(status: 'APPROVED' | 'REJECTED', count: number) {
  const icon = status === 'APPROVED' ? '✅' : '❌';
  const label = status === 'APPROVED' ? 'อนุมัติ' : 'ปฏิเสธ';
  await sendLine(`\n${icon} ${label}การจอง ${count} รายการ`);
}
