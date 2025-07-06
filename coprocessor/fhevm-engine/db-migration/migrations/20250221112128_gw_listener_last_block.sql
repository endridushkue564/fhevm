CREATE TABLE IF NOT EXISTS gw_listener_last_block (
    dummy_id BOOLEAN PRIMARY KEY DEFAULT true,
    last_block_num BIGINT CHECK (last_block_num >= 0)
)
