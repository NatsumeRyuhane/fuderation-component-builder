// A correct rejection halts the DSL before either FAIL marker is written.
setText('[data-guard-status]', 'ARMED · intentional mismatch follows')
wait(40)
requireInputEquals('[data-wrong]', 'EXPECTED', 'EXPECTED diagnostic rejection')
setText('[data-guard-status]', 'FAIL · execution continued after the mismatch')
setText('[data-forbidden]', 'REACHED — FAIL')
setStyle('[data-forbidden]', 'color', '#b91c1c')
